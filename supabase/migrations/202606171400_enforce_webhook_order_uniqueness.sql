-- ============================================================
-- Enforce multi-tenant uniqueness for webhook-imported orders.
--
-- Background:
--   The previous unique index
--     orders_platform_external_order_uidx (platform_source, external_order_id)
--   does not include user_id. With multiple tenants connected to the
--   same upstream platform the same external_order_id would collide
--   across tenants (last writer wins).
--
-- Strategy:
--   1. Audit existing rows for cross-tenant duplicates on
--      (platform_source, external_order_id). If any are found, log
--      them in a temp table `orders_dup_audit` for manual review but
--      do NOT delete — the user must decide which row wins.
--   2. Replace the old index with a user-scoped unique index.
--      This step will fail loudly if duplicates remain.
--   3. Recreate the original lookup index (no constraint).
-- ============================================================

-- 1. Audit cross-tenant duplicates
drop table if exists pg_temp.orders_dup_audit;
create temp table orders_dup_audit on commit drop as
  select platform_source, external_order_id, count(*) as tenant_count,
         array_agg(user_id) as user_ids
    from public.orders
   where external_order_id is not null
     and btrim(external_order_id) <> ''
   group by platform_source, external_order_id
  having count(distinct user_id) > 1;

do $$
declare
  dup_count int;
begin
  select count(*) into dup_count from pg_temp.orders_dup_audit;
  if dup_count > 0 then
    raise notice 'Found % cross-tenant duplicate (platform_source, external_order_id) groups. Inspect temp table orders_dup_audit before proceeding.', dup_count;
  end if;
end $$;

-- 2. Drop old global unique index
drop index if exists public.orders_platform_external_order_uidx;

-- 3. Create user-scoped unique index (idempotent)
--    Will FAIL if cross-tenant duplicates exist — surface them via the
--    audit table above, then either dedupe manually or change the
--    strategy.
create unique index if not exists orders_user_platform_external_uidx
  on public.orders (user_id, platform_source, external_order_id)
  where external_order_id is not null
    and btrim(external_order_id) <> '';

-- 4. Recreate the original lookup index (no constraint).
--    (May already exist from migration 202606061805; CREATE IF NOT EXISTS.)
create index if not exists orders_external_order_id_idx
  on public.orders (external_order_id);

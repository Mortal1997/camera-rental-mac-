alter table if exists public.orders
  add column if not exists platform_source text,
  add column if not exists shipping_method text,
  add column if not exists expected_equipment_model text,
  add column if not exists external_order_id text,
  add column if not exists metadata jsonb;

alter table if exists public.orders
  alter column equipment_id drop not null,
  alter column status type text;

update public.orders
set status = case
  when status is null or status = '' then 'pending_payment'
  when status not in ('unprocessed', 'pending_payment', 'confirmed', 'using', 'returned', 'cancelled') then 'pending_payment'
  else status
end;

alter table if exists public.orders
  alter column status set default 'pending_payment';

alter table if exists public.orders
  add constraint orders_status_check
  check (status in ('unprocessed', 'pending_payment', 'confirmed', 'using', 'returned', 'cancelled')) not valid;

alter table public.orders
  validate constraint orders_status_check;

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_platform_source_idx on public.orders (platform_source);
create index if not exists orders_external_order_id_idx on public.orders (external_order_id);
create unique index if not exists orders_platform_external_order_uidx
  on public.orders (platform_source, external_order_id)
  where external_order_id is not null and btrim(external_order_id) <> '';

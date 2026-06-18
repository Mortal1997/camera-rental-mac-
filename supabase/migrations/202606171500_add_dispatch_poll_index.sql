-- ============================================================
-- Add poll-friendly index for the dispatch center's polling query.
--
-- Background:
--   RefreshRemoteOrders.tsx (5s polling) runs this query continuously
--   while a user is on /admin/orders/dispatch:
--
--     select id, status, created_at
--       from orders
--      where user_id = ?
--        and status in ('unprocessed', 'pending_payment')
--        and created_at > <last_seen>
--      order by created_at desc
--      limit 1
--
--   Without a matching index this is a sequential scan per user per tick.
--   The index also doubles as the (user_id, status) filter used by RLS.
--
-- Note:
--   `orders` has `created_at` (timestamptz) but no `updated_at`, so we
--   poll on created_at. This means "status changes for an existing row"
--   won't be picked up by the cursor, but the dispatch page only cares
--   about new unprocessed orders, and new rows are always inserted with
--   a fresh created_at.
-- ============================================================

create index if not exists orders_user_status_created_at_idx
  on public.orders (user_id, status, created_at desc)
  where status in ('unprocessed', 'pending_payment');

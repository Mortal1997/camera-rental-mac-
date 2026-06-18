-- ============================================================
-- Enable Realtime for orders so dispatch center can subscribe
-- to INSERT events via postgres_changes.
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

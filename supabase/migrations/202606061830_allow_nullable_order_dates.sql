alter table if exists public.orders
  alter column start_date drop not null,
  alter column end_date drop not null;

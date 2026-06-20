-- ============================================================
-- Manual expense ledger for the finance dashboard.
--
-- Captures per-month operating costs (rent, utilities, salaries, etc.)
-- that are NOT tied to any single order. Aggregated by the finance
-- report endpoint to compute net profit / gross margin.
-- ============================================================

create table if not exists public.expense_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,                       -- 'YYYY-MM'
  category text not null,                    -- free text; constrained by UI to known categories
  amount numeric(12, 2) not null check (amount >= 0),
  note text,
  created_at timestamptz not null default now()
);

-- Per-tenant month scans
create index if not exists expense_items_user_month_idx
  on public.expense_items (user_id, month);

-- Enforce month shape; cheaper than relying on UI alone
alter table public.expense_items
  drop constraint if exists expense_items_month_format_chk;
alter table public.expense_items
  add constraint expense_items_month_format_chk
  check (month ~ '^\d{4}-(0[1-9]|1[0-2])$');

-- RLS
alter table public.expense_items enable row level security;

drop policy if exists "expense_items_select_own" on public.expense_items;
create policy "expense_items_select_own"
  on public.expense_items
  for select
  using (auth.uid() = user_id);

drop policy if exists "expense_items_insert_own" on public.expense_items;
create policy "expense_items_insert_own"
  on public.expense_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "expense_items_delete_own" on public.expense_items;
create policy "expense_items_delete_own"
  on public.expense_items
  for delete
  using (auth.uid() = user_id);

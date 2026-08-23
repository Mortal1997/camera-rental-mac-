-- Align application authorization with Supabase Auth identities, remove legacy
-- credential storage, and replace permissive tenant policies with least-
-- privilege RLS rules.

begin;

-- Auth identity links --------------------------------------------------------
alter table public.pending_users
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;
alter table public.approved_users
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;
alter table public.admin_users
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;

update public.pending_users as pending
set auth_user_id = auth_user.id
from auth.users as auth_user
where pending.auth_user_id is null and lower(pending.email) = lower(auth_user.email);
update public.approved_users as approved
set auth_user_id = auth_user.id
from auth.users as auth_user
where approved.auth_user_id is null and lower(approved.email) = lower(auth_user.email);
update public.admin_users as admin
set auth_user_id = auth_user.id
from auth.users as auth_user
where admin.auth_user_id is null and lower(admin.email) = lower(auth_user.email);

create unique index if not exists pending_users_auth_user_id_key on public.pending_users(auth_user_id);
create unique index if not exists approved_users_auth_user_id_key on public.approved_users(auth_user_id);
create unique index if not exists admin_users_auth_user_id_key on public.admin_users(auth_user_id);

alter table public.pending_users alter column auth_user_id set not null;
alter table public.approved_users alter column auth_user_id set not null;
alter table public.admin_users alter column auth_user_id set not null;

-- Passwords belong only in Supabase Auth.
update public.pending_users set password_hash = null where password_hash is not null;
alter table public.pending_users drop column if exists password_hash;

-- Management-table privileges and RLS --------------------------------------
alter table public.admin_users enable row level security;
alter table public.approved_users enable row level security;
alter table public.pending_users enable row level security;
alter table public.user_activity_log enable row level security;

revoke all on table public.admin_users, public.approved_users,
  public.pending_users, public.user_activity_log from anon;
revoke all on table public.admin_users, public.approved_users,
  public.pending_users, public.user_activity_log from authenticated;
grant select on table public.admin_users to authenticated;
grant select, insert, delete on table public.approved_users to authenticated;
grant select, delete on table public.pending_users to authenticated;
grant select, insert on table public.user_activity_log to authenticated;

drop policy if exists "anon_all_admin_users" on public.admin_users;
drop policy if exists "admin_users_select_self" on public.admin_users;
create policy "admin_users_select_self" on public.admin_users
  for select to authenticated using (auth_user_id = (select auth.uid()));

drop policy if exists "allow_insert_approved" on public.approved_users;
drop policy if exists "allow_select_approved" on public.approved_users;
drop policy if exists "anon_all_approved_users" on public.approved_users;
drop policy if exists "approved_users_select_authorized" on public.approved_users;
drop policy if exists "approved_users_insert_super_admin" on public.approved_users;
drop policy if exists "approved_users_delete_super_admin" on public.approved_users;
create policy "approved_users_select_authorized" on public.approved_users
  for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    or exists (
      select 1 from public.admin_users as admin
      where admin.auth_user_id = (select auth.uid()) and admin.role = 'super_admin'
    )
  );
create policy "approved_users_insert_super_admin" on public.approved_users
  for insert to authenticated
  with check (
    exists (
      select 1 from public.admin_users as admin
      where admin.auth_user_id = (select auth.uid()) and admin.role = 'super_admin'
    )
  );
create policy "approved_users_delete_super_admin" on public.approved_users
  for delete to authenticated
  using (
    exists (
      select 1 from public.admin_users as admin
      where admin.auth_user_id = (select auth.uid()) and admin.role = 'super_admin'
    )
  );

drop policy if exists "allow_delete_pending" on public.pending_users;
drop policy if exists "allow_insert_pending" on public.pending_users;
drop policy if exists "allow_select_pending" on public.pending_users;
drop policy if exists "anon_all_pending_users" on public.pending_users;
drop policy if exists "pending_users_select_super_admin" on public.pending_users;
drop policy if exists "pending_users_delete_super_admin" on public.pending_users;
create policy "pending_users_select_super_admin" on public.pending_users
  for select to authenticated
  using (
    exists (
      select 1 from public.admin_users as admin
      where admin.auth_user_id = (select auth.uid()) and admin.role = 'super_admin'
    )
  );
create policy "pending_users_delete_super_admin" on public.pending_users
  for delete to authenticated
  using (
    exists (
      select 1 from public.admin_users as admin
      where admin.auth_user_id = (select auth.uid()) and admin.role = 'super_admin'
    )
  );

drop policy if exists "super_admin can insert logs" on public.user_activity_log;
drop policy if exists "super_admin can read logs" on public.user_activity_log;
drop policy if exists "user_activity_log_select_super_admin" on public.user_activity_log;
drop policy if exists "user_activity_log_insert_super_admin" on public.user_activity_log;
create policy "user_activity_log_select_super_admin" on public.user_activity_log
  for select to authenticated
  using (
    exists (
      select 1 from public.admin_users as admin
      where admin.auth_user_id = (select auth.uid()) and admin.role = 'super_admin'
    )
  );
create policy "user_activity_log_insert_super_admin" on public.user_activity_log
  for insert to authenticated
  with check (
    exists (
      select 1 from public.admin_users as admin
      where admin.auth_user_id = (select auth.uid())
        and admin.role = 'super_admin'
        and lower(admin.email) = lower(operator_email)
    )
  );

-- Tenant tables: one optimized ownership policy per table -------------------
revoke all on table public.equipment, public.orders,
  public.expense_items, public.user_settings from anon;

drop policy if exists "1111" on public.equipment;
drop policy if exists "equipment_owner_access" on public.equipment;
create policy "equipment_owner_access" on public.equipment
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Enable full access for users based on user_id" on public.orders;
drop policy if exists "Users can delete own orders" on public.orders;
drop policy if exists "Users can insert own orders" on public.orders;
drop policy if exists "Users can update own orders" on public.orders;
drop policy if exists "Users can view own orders" on public.orders;
drop policy if exists "orders_owner_access" on public.orders;
create policy "orders_owner_access" on public.orders
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "expense_items_select_own" on public.expense_items;
drop policy if exists "expense_items_insert_own" on public.expense_items;
drop policy if exists "expense_items_delete_own" on public.expense_items;
drop policy if exists "expense_items_owner_access" on public.expense_items;
create policy "expense_items_owner_access" on public.expense_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete own settings" on public.user_settings;
drop policy if exists "Users can insert own settings" on public.user_settings;
drop policy if exists "Users can update own settings" on public.user_settings;
drop policy if exists "Users can view own settings" on public.user_settings;
drop policy if exists "users_delete_own_settings" on public.user_settings;
drop policy if exists "users_insert_own_settings" on public.user_settings;
drop policy if exists "users_select_own_settings" on public.user_settings;
drop policy if exists "users_update_own_settings" on public.user_settings;
drop policy if exists "user_settings_owner_access" on public.user_settings;
create policy "user_settings_owner_access" on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Explicit grants keep the Data API contract stable as Supabase transitions
-- away from automatically exposing new public tables.
grant select, insert, update, delete on table public.equipment, public.orders,
  public.user_settings to authenticated;
grant select, insert, delete on table public.expense_items to authenticated;

-- Integrity and performance --------------------------------------------------
alter table public.orders drop constraint if exists orders_date_range_chk;
alter table public.orders add constraint orders_date_range_chk
  check (start_date is null or end_date is null or start_date <= end_date);

create index if not exists equipment_user_id_idx on public.equipment(user_id);
create index if not exists orders_equipment_id_idx on public.orders(equipment_id);
drop index if exists public.idx_user_settings_user_id;

alter function public.handle_updated_at() set search_path = '';
alter function public.update_updated_at_column() set search_path = '';

commit;

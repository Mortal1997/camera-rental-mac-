alter table if exists public.equipment
  add column if not exists category text,
  add column if not exists serial_number text,
  add column if not exists warranty_expire_date date;

alter table if exists public.equipment
  alter column status type text;

update public.equipment
set status = case
  when status is null or status = '' then 'available'
  when status not in ('available', 'maintenance', 'rented') then 'available'
  else status
end;

alter table if exists public.equipment
  alter column status set default 'available';

alter table if exists public.equipment
  add constraint equipment_status_check
  check (status in ('available', 'maintenance', 'rented')) not valid;

alter table public.equipment
  validate constraint equipment_status_check;

create index if not exists equipment_status_idx on public.equipment (status);
create index if not exists equipment_serial_number_idx on public.equipment (serial_number);

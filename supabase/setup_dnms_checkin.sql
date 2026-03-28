-- DNMS Check-in: schema esperado pelo app (idempotente)
-- Execute no Supabase SQL Editor do projeto correto.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role text not null default 'responsavel' check (role in ('admin', 'equipe', 'responsavel', 'dnms_kids')),
  email text unique,
  birth_date date null,
  marital_status text null,
  phone text null,
  photo_url text null,
  is_visitor boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_date date not null,
  class_name text not null,
  primary_guardian_name text not null,
  phone text not null,
  address text not null,
  notes text null,
  photo_url text null,
  is_visitor boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null,
  time text not null,
  class_target text not null,
  status text not null default 'Programada' check (status in ('Programada', 'Aberta', 'Fechada')),
  opened_at timestamptz null,
  closed_at timestamptz null,
  created_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  class_name text not null,
  actor_id uuid null references public.profiles (id) on delete set null,
  notes_snapshot text null,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz null,
  printed_at timestamptz null
);

create table if not exists public.student_guardians (
  student_id uuid not null references public.students (id) on delete cascade,
  guardian_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, guardian_id)
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null default 'dnms_kids' check (role in ('dnms_kids')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  accepted_at timestamptz null,
  created_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.dashboard_settings (
  id int primary key default 1 check (id = 1),
  info_text text not null default '',
  updated_by uuid null references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  profile_id uuid null references public.profiles (id) on delete set null,
  lesson_theme text not null,
  details text not null default '',
  created_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  recipient_id uuid null references public.profiles (id) on delete set null,
  created_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.tip_reads (
  tip_id uuid not null references public.tips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (tip_id, user_id)
);

create index if not exists idx_students_guardian_name on public.students (primary_guardian_name);
create index if not exists idx_rooms_date_status on public.rooms (date, status);
create index if not exists idx_checkins_room_student on public.checkins (room_id, student_id);
create index if not exists idx_checkins_student_checkedin on public.checkins (student_id, checked_in_at desc);
create index if not exists idx_invites_token on public.invites (token);
create index if not exists idx_schedules_date on public.schedules (date);
create index if not exists idx_tips_recipient on public.tips (recipient_id, created_at desc);
create index if not exists idx_tip_reads_user on public.tip_reads (user_id, read_at desc);

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.rooms enable row level security;
alter table public.checkins enable row level security;
alter table public.student_guardians enable row level security;
alter table public.invites enable row level security;
alter table public.dashboard_settings enable row level security;
alter table public.schedules enable row level security;
alter table public.tips enable row level security;
alter table public.tip_reads enable row level security;

drop policy if exists profiles_select_own_or_staff on public.profiles;
create policy profiles_select_own_or_staff on public.profiles
for select to authenticated
using (
  auth.uid() = id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe')
  )
);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert to authenticated
with check (auth.uid() = id);

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin on public.profiles
for update to authenticated
using (
  auth.uid() = id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  auth.uid() = id
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists students_select_staff_or_guardian on public.students;
create policy students_select_staff_or_guardian on public.students
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe')
  )
  or exists (
    select 1 from public.student_guardians sg
    where sg.student_id = students.id and sg.guardian_id = auth.uid()
  )
);

drop policy if exists students_insert_staff_or_guardian on public.students;
create policy students_insert_staff_or_guardian on public.students
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe', 'responsavel')
  )
);

drop policy if exists students_update_staff_or_guardian on public.students;
create policy students_update_staff_or_guardian on public.students
for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe')
  )
  or exists (
    select 1 from public.student_guardians sg
    where sg.student_id = students.id and sg.guardian_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe')
  )
  or exists (
    select 1 from public.student_guardians sg
    where sg.student_id = students.id and sg.guardian_id = auth.uid()
  )
);

drop policy if exists rooms_select_authenticated on public.rooms;
create policy rooms_select_authenticated on public.rooms
for select to authenticated
using (true);

drop policy if exists rooms_manage_staff on public.rooms;
create policy rooms_manage_staff on public.rooms
for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe')
  )
);

drop policy if exists checkins_select_staff_or_guardian on public.checkins;
create policy checkins_select_staff_or_guardian on public.checkins
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe')
  )
  or exists (
    select 1 from public.student_guardians sg
    where sg.student_id = checkins.student_id and sg.guardian_id = auth.uid()
  )
);

drop policy if exists checkins_insert_staff_or_guardian on public.checkins;
create policy checkins_insert_staff_or_guardian on public.checkins
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe')
  )
  or exists (
    select 1 from public.student_guardians sg
    where sg.student_id = checkins.student_id and sg.guardian_id = auth.uid()
  )
);

drop policy if exists checkins_update_staff on public.checkins;
create policy checkins_update_staff on public.checkins
for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe')
  )
);

drop policy if exists student_guardians_select_staff_or_self on public.student_guardians;
create policy student_guardians_select_staff_or_self on public.student_guardians
for select to authenticated
using (
  guardian_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe')
  )
);

drop policy if exists student_guardians_insert_staff_or_self on public.student_guardians;
create policy student_guardians_insert_staff_or_self on public.student_guardians
for insert to authenticated
with check (
  guardian_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe')
  )
);

drop policy if exists invites_select_admin_only on public.invites;
create policy invites_select_admin_only on public.invites
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists invites_insert_admin_only on public.invites;
create policy invites_insert_admin_only on public.invites
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists invites_update_admin_or_matching_email on public.invites;
create policy invites_update_admin_or_matching_email on public.invites
for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
  or lower(invites.email) = lower((select u.email from auth.users u where u.id = auth.uid()))
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
  or lower(invites.email) = lower((select u.email from auth.users u where u.id = auth.uid()))
);

drop policy if exists dashboard_settings_select_all on public.dashboard_settings;
create policy dashboard_settings_select_all on public.dashboard_settings
for select to authenticated
using (true);

drop policy if exists dashboard_settings_manage_admin on public.dashboard_settings;
create policy dashboard_settings_manage_admin on public.dashboard_settings
for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists schedules_select_scope on public.schedules;
create policy schedules_select_scope on public.schedules
for select to authenticated
using (
  profile_id is null
  or profile_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe')
  )
);

drop policy if exists schedules_manage_admin on public.schedules;
create policy schedules_manage_admin on public.schedules
for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists tips_select_scope on public.tips;
create policy tips_select_scope on public.tips
for select to authenticated
using (
  recipient_id is null
  or recipient_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe')
  )
);

drop policy if exists tips_insert_admin on public.tips;
create policy tips_insert_admin on public.tips
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists tip_reads_select_own on public.tip_reads;
create policy tip_reads_select_own on public.tip_reads
for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists tip_reads_insert_own on public.tip_reads;
create policy tip_reads_insert_own on public.tip_reads
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists tip_reads_upsert_own on public.tip_reads;
create policy tip_reads_upsert_own on public.tip_reads
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.ensure_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role, email, birth_date, marital_status, phone, is_visitor)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1), 'Usuario'),
    coalesce(new.raw_user_meta_data ->> 'desired_role', 'responsavel'),
    new.email,
    nullif(new.raw_user_meta_data ->> 'birth_date', '')::date,
    nullif(new.raw_user_meta_data ->> 'marital_status', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    coalesce((new.raw_user_meta_data ->> 'is_visitor')::boolean, false)
  )
  on conflict (id) do update
  set
    name = excluded.name,
    role = excluded.role,
    email = excluded.email,
    birth_date = excluded.birth_date,
    marital_status = excluded.marital_status,
    phone = excluded.phone,
    is_visitor = excluded.is_visitor;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_dnms on auth.users;
create trigger on_auth_user_created_dnms
after insert on auth.users
for each row execute procedure public.ensure_profile_for_new_user();

insert into public.dashboard_settings (id, info_text)
values (1, '')
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('dnms-photos', 'dnms-photos', true)
on conflict (id) do nothing;

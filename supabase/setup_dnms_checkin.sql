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

alter table public.profiles
  drop constraint if exists profiles_responsavel_phone_required;
alter table public.profiles
  add constraint profiles_responsavel_phone_required
  check (role <> 'responsavel' or nullif(btrim(phone), '') is not null)
  not valid;

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
  target_user text null,
  lesson_theme text not null,
  details text not null default '',
  created_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.schedules
  add column if not exists target_user text null;

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

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null default 'reprint' check (job_type in ('reprint')),
  checkin_id uuid not null references public.checkins (id) on delete cascade,
  requested_by uuid null references public.profiles (id) on delete set null default auth.uid(),
  status text not null default 'pending' check (status in ('pending', 'processing', 'printed', 'failed')),
  attempts integer not null default 0,
  claimed_by text null,
  claimed_at timestamptz null,
  printed_at timestamptz null,
  failed_at timestamptz null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_students_guardian_name on public.students (primary_guardian_name);
create index if not exists idx_rooms_date_status on public.rooms (date, status);
create index if not exists idx_checkins_room_student on public.checkins (room_id, student_id);
create index if not exists idx_checkins_student_checkedin on public.checkins (student_id, checked_in_at desc);
create unique index if not exists checkins_one_active_per_student
  on public.checkins (student_id)
  where checked_out_at is null;
create index if not exists idx_invites_token on public.invites (token);
create index if not exists idx_schedules_date on public.schedules (date);
create index if not exists idx_schedules_target_user on public.schedules (target_user);
create index if not exists idx_tips_recipient on public.tips (recipient_id, created_at desc);
create index if not exists idx_tip_reads_user on public.tip_reads (user_id, read_at desc);
create index if not exists idx_print_jobs_status_created_at on public.print_jobs (status, created_at);
create index if not exists idx_print_jobs_checkin on public.print_jobs (checkin_id);
create unique index if not exists print_jobs_one_open_reprint_per_checkin
on public.print_jobs (checkin_id)
where job_type = 'reprint' and status in ('pending', 'processing');

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
alter table public.print_jobs enable row level security;

create or replace function public.is_staff_user(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid and p.role in ('admin', 'equipe', 'dnms_kids')
  );
$$;

create or replace function public.is_admin_user(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid and p.role = 'admin'
  );
$$;

grant execute on function public.is_staff_user(uuid) to authenticated;
grant execute on function public.is_admin_user(uuid) to authenticated;

create or replace function public.claim_next_reprint_job(worker_id text default null)
returns table (
  id uuid,
  checkin_id uuid,
  attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with next_job as (
    select pj.id
    from public.print_jobs pj
    where pj.job_type = 'reprint'
      and (
        pj.status = 'pending'
        or (pj.status = 'processing' and pj.claimed_at < now() - interval '2 minutes')
      )
      and pj.attempts < 5
    order by pj.created_at asc
    for update skip locked
    limit 1
  )
  update public.print_jobs pj
  set
    status = 'processing',
    attempts = pj.attempts + 1,
    claimed_by = nullif(btrim(worker_id), ''),
    claimed_at = now(),
    updated_at = now(),
    error_message = null
  from next_job
  where pj.id = next_job.id
  returning pj.id, pj.checkin_id, pj.attempts;
end;
$$;

revoke all on function public.claim_next_reprint_job(text) from public;
grant execute on function public.claim_next_reprint_job(text) to service_role;

create or replace function public.normalize_student_duplicate_text(value text)
returns text
language sql
immutable
as $$
  select lower(
    regexp_replace(
      btrim(
        translate(
          coalesce(value, ''),
          'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
          'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
        )
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.prevent_duplicate_student_for_guardian()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  duplicate_id uuid;
  duplicate_key text;
begin
  duplicate_key :=
    public.normalize_student_duplicate_text(new.name) || '|' ||
    coalesce(new.birth_date::text, '');

  perform pg_advisory_xact_lock(hashtext(duplicate_key)::bigint);

  select s.id
  into duplicate_id
  from public.students s
  where s.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and s.birth_date = new.birth_date
    and public.normalize_student_duplicate_text(s.name) = public.normalize_student_duplicate_text(new.name)
  limit 1;

  if duplicate_id is not null then
    raise exception 'duplicate_student'
      using errcode = '23505',
        detail = 'Esta crianca ja esta cadastrada.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_duplicate_student_for_guardian_trigger on public.students;
create trigger prevent_duplicate_student_for_guardian_trigger
before insert or update of name, birth_date on public.students
for each row execute function public.prevent_duplicate_student_for_guardian();

create or replace function public.can_manage_profile(actor uuid, target uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  actor_email text;
  target_role text;
begin
  if actor is null or target is null then
    return false;
  end if;
  if actor = target then
    return false;
  end if;

  select lower(coalesce(p.email, '')), lower(coalesce(p.role, ''))
    into actor_email, actor_role
  from public.profiles p
  where p.id = actor;

  if actor_role is null then
    return false;
  end if;

  if actor_email = 'marvinlabre@gmail.com' then
    return true;
  end if;

  select lower(coalesce(p.role, ''))
    into target_role
  from public.profiles p
  where p.id = target;

  if target_role is null then
    return false;
  end if;

  if actor_role = 'admin' then
    return target_role in ('equipe', 'responsavel', 'dnms_kids');
  end if;

  if actor_role in ('equipe', 'dnms_kids') then
    return target_role in ('responsavel', 'dnms_kids');
  end if;

  return false;
end;
$$;

grant execute on function public.can_manage_profile(uuid, uuid) to authenticated;

create or replace function public.can_delete_profile(actor uuid, target uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  actor_email text;
  target_role text;
begin
  if actor is null or target is null or actor = target then
    return false;
  end if;

  select lower(coalesce(p.email, '')), lower(coalesce(p.role, ''))
    into actor_email, actor_role
  from public.profiles p
  where p.id = actor;

  if actor_role is null then
    return false;
  end if;

  if actor_email = 'marvinlabre@gmail.com' then
    return true;
  end if;

  select lower(coalesce(p.role, ''))
    into target_role
  from public.profiles p
  where p.id = target;

  if target_role is null then
    return false;
  end if;

  if actor_role = 'admin' then
    return target_role in ('equipe', 'responsavel', 'dnms_kids');
  end if;

  return false;
end;
$$;

grant execute on function public.can_delete_profile(uuid, uuid) to authenticated;

create or replace function public.delete_user_account(target_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_profile record;
  primary_student_ids uuid[] := array[]::uuid[];
  deleted_children text[] := array[]::text[];
  deleted_auth_count integer := 0;
begin
  if actor_id is null then
    raise exception 'Autenticacao obrigatoria para excluir usuario.';
  end if;

  if target_profile_id is null then
    raise exception 'Usuario alvo invalido.';
  end if;

  if not public.can_delete_profile(actor_id, target_profile_id) then
    raise exception 'Sem permissao para excluir este usuario.';
  end if;

  select p.*
    into target_profile
  from public.profiles p
  where p.id = target_profile_id;

  if target_profile.id is null then
    raise exception 'Perfil nao encontrado.';
  end if;

  select
    coalesce(array_agg(s.id), array[]::uuid[]),
    coalesce(array_agg(s.name), array[]::text[])
    into primary_student_ids, deleted_children
  from public.students s
  where
    lower(btrim(coalesce(s.primary_guardian_name, ''))) = lower(btrim(coalesce(target_profile.name, '')))
    or (
      nullif(btrim(coalesce(s.primary_guardian_name, '')), '') is null
      and exists (
        select 1
        from public.student_guardians sg
        where sg.student_id = s.id
          and sg.guardian_id = target_profile_id
      )
    );

  if coalesce(array_length(primary_student_ids, 1), 0) > 0 then
    delete from public.checkins
    where student_id = any(primary_student_ids);

    delete from public.student_guardians
    where student_id = any(primary_student_ids);

    delete from public.students
    where id = any(primary_student_ids);
  end if;

  delete from public.student_guardians
  where guardian_id = target_profile_id;

  delete from auth.users
  where id = target_profile_id;
  get diagnostics deleted_auth_count = row_count;

  if deleted_auth_count = 0 then
    delete from public.profiles
    where id = target_profile_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'deleted_auth_user', deleted_auth_count > 0,
    'deleted_children', coalesce(deleted_children, array[]::text[]),
    'deleted_primary_student_ids', coalesce(primary_student_ids, array[]::uuid[])
  );
end;
$$;

revoke all on function public.delete_user_account(uuid) from public;
grant execute on function public.delete_user_account(uuid) to authenticated;

create or replace function public.can_update_profile_with_role(actor uuid, target uuid, new_role text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  actor_email text;
  target_role text;
  normalized_new_role text;
begin
  if actor is null or target is null then
    return false;
  end if;

  normalized_new_role := lower(coalesce(new_role, ''));
  if normalized_new_role not in ('admin', 'equipe', 'responsavel', 'dnms_kids') then
    return false;
  end if;

  select lower(coalesce(p.email, '')), lower(coalesce(p.role, ''))
    into actor_email, actor_role
  from public.profiles p
  where p.id = actor;

  if actor_role is null then
    return false;
  end if;

  select lower(coalesce(p.role, ''))
    into target_role
  from public.profiles p
  where p.id = target;

  if target_role is null then
    return false;
  end if;

  if actor = target then
    return normalized_new_role = target_role;
  end if;

  if actor_email = 'marvinlabre@gmail.com' then
    return true;
  end if;

  if actor_role = 'admin' then
    return target_role in ('equipe', 'responsavel', 'dnms_kids')
      and normalized_new_role in ('equipe', 'responsavel', 'dnms_kids');
  end if;

  if actor_role in ('equipe', 'dnms_kids') then
    return target_role in ('responsavel', 'dnms_kids')
      and normalized_new_role = target_role;
  end if;

  return false;
end;
$$;

grant execute on function public.can_update_profile_with_role(uuid, uuid, text) to authenticated;

drop policy if exists profiles_select_own_or_staff on public.profiles;
create policy profiles_select_own_or_staff on public.profiles
for select to authenticated
using (auth.uid() = id or public.is_staff_user(auth.uid()));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert to authenticated
with check (auth.uid() = id);

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin on public.profiles
for update to authenticated
using (auth.uid() = id or public.can_manage_profile(auth.uid(), id))
with check (public.can_update_profile_with_role(auth.uid(), id, role));

drop policy if exists profiles_delete_manageable on public.profiles;
create policy profiles_delete_manageable on public.profiles
for delete to authenticated
using (public.can_delete_profile(auth.uid(), id));

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

drop policy if exists students_delete_admin_only on public.students;
create policy students_delete_admin_only on public.students
for delete to authenticated
using (
  public.is_admin_user(auth.uid())
  or lower(coalesce((select p.email from public.profiles p where p.id = auth.uid()), '')) = 'marvinlabre@gmail.com'
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

drop policy if exists print_jobs_select_staff_or_requester on public.print_jobs;
create policy print_jobs_select_staff_or_requester on public.print_jobs
for select to authenticated
using (
  public.is_staff_user(auth.uid())
  or requested_by = auth.uid()
  or exists (
    select 1
    from public.checkins c
    join public.student_guardians sg on sg.student_id = c.student_id
    where c.id = print_jobs.checkin_id and sg.guardian_id = auth.uid()
  )
);

drop policy if exists print_jobs_insert_staff_or_guardian on public.print_jobs;
create policy print_jobs_insert_staff_or_guardian on public.print_jobs
for insert to authenticated
with check (
  job_type = 'reprint'
  and status = 'pending'
  and coalesce(attempts, 0) = 0
  and (
    public.is_staff_user(auth.uid())
    or exists (
      select 1
      from public.checkins c
      join public.student_guardians sg on sg.student_id = c.student_id
      where c.id = print_jobs.checkin_id and sg.guardian_id = auth.uid()
    )
  )
);

drop policy if exists print_jobs_update_staff on public.print_jobs;
create policy print_jobs_update_staff on public.print_jobs
for update to authenticated
using (public.is_staff_user(auth.uid()))
with check (public.is_staff_user(auth.uid()));

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
declare
  v_role text;
  v_phone text;
begin
  v_role := coalesce(new.raw_user_meta_data ->> 'desired_role', 'responsavel');
  v_phone := nullif(new.raw_user_meta_data ->> 'phone', '');
  if v_role = 'responsavel' and nullif(btrim(v_phone), '') is null then
    raise exception 'Telefone obrigatorio para responsavel';
  end if;

  insert into public.profiles (id, name, role, email, birth_date, marital_status, phone, is_visitor)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1), 'Usuario'),
    v_role,
    new.email,
    nullif(new.raw_user_meta_data ->> 'birth_date', '')::date,
    nullif(new.raw_user_meta_data ->> 'marital_status', ''),
    v_phone,
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

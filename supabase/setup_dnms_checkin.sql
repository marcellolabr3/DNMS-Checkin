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
  family_id uuid null,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists family_id uuid null;

update public.profiles
set family_id = id
where family_id is null
  and lower(coalesce(role, '')) = 'responsavel';

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

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid null references public.profiles (id) on delete set null,
  actor_name text not null default '',
  actor_role text not null default '',
  action_type text not null,
  target_type text not null,
  target_id uuid null,
  target_name text not null default '',
  details text not null default '',
  metadata jsonb not null default '{}'::jsonb
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
  role text not null default 'dnms_kids' check (role in ('dnms_kids', 'equipe', 'admin', 'responsavel')),
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
  created_at timestamptz not null default now(),
  sender_name text null
);

alter table public.invites
  drop constraint if exists invites_role_check;

alter table public.invites
  add constraint invites_role_check
  check (role in ('dnms_kids', 'equipe', 'admin', 'responsavel'));

alter table public.tips
  add column if not exists sender_name text null;

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
create index if not exists idx_profiles_family_id on public.profiles (family_id);
create index if not exists idx_rooms_date_status on public.rooms (date, status);
create index if not exists idx_checkins_room_student on public.checkins (room_id, student_id);
create index if not exists idx_checkins_student_checkedin on public.checkins (student_id, checked_in_at desc);
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_action_type on public.audit_logs (action_type);
create index if not exists idx_audit_logs_target on public.audit_logs (target_type, target_id);
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
alter table public.audit_logs enable row level security;
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
  target_family_id uuid;
begin
  select coalesce(p.family_id, p.id)
  into target_family_id
  from public.profiles p
  where lower(coalesce(p.role, '')) = 'responsavel'
    and (
      public.normalize_student_duplicate_text(p.name) = public.normalize_student_duplicate_text(new.primary_guardian_name)
      or (auth.uid() = p.id and nullif(btrim(coalesce(new.primary_guardian_name, '')), '') is not null)
    )
  order by case when auth.uid() = p.id then 0 else 1 end
  limit 1;

  duplicate_key :=
    public.normalize_student_duplicate_text(new.name) || '|' ||
    coalesce(new.birth_date::text, '') || '|' ||
    coalesce(target_family_id::text, public.normalize_student_duplicate_text(new.primary_guardian_name));

  perform pg_advisory_xact_lock(hashtext(duplicate_key)::bigint);

  if target_family_id is not null then
    select s.id
    into duplicate_id
    from public.students s
    where s.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and s.birth_date = new.birth_date
      and public.normalize_student_duplicate_text(s.name) = public.normalize_student_duplicate_text(new.name)
      and (
        exists (
          select 1
          from public.student_guardians sg
          join public.profiles p on p.id = sg.guardian_id
          where sg.student_id = s.id
            and coalesce(p.family_id, p.id) = target_family_id
        )
        or exists (
          select 1
          from public.profiles p
          where coalesce(p.family_id, p.id) = target_family_id
            and public.normalize_student_duplicate_text(p.name) =
              public.normalize_student_duplicate_text(s.primary_guardian_name)
        )
      )
    limit 1;
  else
    select s.id
    into duplicate_id
    from public.students s
    where s.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and s.birth_date = new.birth_date
      and public.normalize_student_duplicate_text(s.name) = public.normalize_student_duplicate_text(new.name)
      and public.normalize_student_duplicate_text(s.primary_guardian_name) =
        public.normalize_student_duplicate_text(new.primary_guardian_name)
    limit 1;
  end if;

  if duplicate_id is not null then
    raise exception 'duplicate_student_for_family'
      using errcode = '23505',
        detail = 'Esta crianca ja esta cadastrada nesta familia.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_duplicate_student_for_guardian_trigger on public.students;
create trigger prevent_duplicate_student_for_guardian_trigger
before insert or update of name, birth_date, primary_guardian_name on public.students
for each row execute function public.prevent_duplicate_student_for_guardian();

create or replace function public.ensure_profile_family_id(profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_family_id uuid;
begin
  if profile_id is null then
    return null;
  end if;

  select family_id
  into current_family_id
  from public.profiles
  where id = profile_id;

  if current_family_id is null then
    update public.profiles
    set family_id = profile_id
    where id = profile_id
    returning family_id into current_family_id;
  end if;

  return current_family_id;
end;
$$;

create or replace function public.sync_student_family_guardians(target_student_id uuid, seed_guardian_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  resolved_guardian_id uuid := coalesce(seed_guardian_id, auth.uid());
  target_family_id uuid;
  inserted_count integer := 0;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  select role into actor_role from public.profiles where id = actor_id;

  if target_student_id is null or resolved_guardian_id is null then
    raise exception 'invalid_family_sync_request';
  end if;

  if actor_id <> resolved_guardian_id and coalesce(actor_role, '') not in ('admin', 'equipe') then
    raise exception 'family_sync_not_allowed';
  end if;

  if coalesce(actor_role, '') not in ('admin', 'equipe') and not exists (
    select 1
    from public.student_guardians sg
    where sg.student_id = target_student_id
      and sg.guardian_id = actor_id
  ) then
    raise exception 'family_sync_student_not_allowed';
  end if;

  target_family_id := public.ensure_profile_family_id(resolved_guardian_id);

  insert into public.student_guardians (student_id, guardian_id)
  select target_student_id, p.id
  from public.profiles p
  where p.family_id = target_family_id
    and lower(coalesce(p.role, '')) = 'responsavel'
  on conflict do nothing;

  get diagnostics inserted_count = row_count;

  return jsonb_build_object(
    'ok', true,
    'family_id', target_family_id,
    'inserted_links', inserted_count
  );
end;
$$;

create or replace function public.get_my_family_network()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  target_family_id uuid;
  members jsonb := '[]'::jsonb;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  select role into actor_role from public.profiles where id = actor_id;
  if coalesce(actor_role, '') <> 'responsavel' then
    return jsonb_build_object('ok', true, 'family_id', null, 'members', '[]'::jsonb);
  end if;

  target_family_id := public.ensure_profile_family_id(actor_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'email', email,
        'phone', phone
      )
      order by name
    ),
    '[]'::jsonb
  )
  into members
  from public.profiles
  where family_id = target_family_id
    and lower(coalesce(role, '')) = 'responsavel';

  return jsonb_build_object(
    'ok', true,
    'family_id', target_family_id,
    'members', members
  );
end;
$$;

create or replace function public.link_family_responsible(target_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_profile record;
  target_profile record;
  actor_family_id uuid;
  target_family_id uuid;
  merged_family_id uuid;
  member_count integer := 0;
  student_count integer := 0;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into actor_profile
  from public.profiles
  where id = actor_id;

  if actor_profile.id is null or lower(coalesce(actor_profile.role, '')) <> 'responsavel' then
    raise exception 'family_link_only_responsavel';
  end if;

  if nullif(btrim(coalesce(target_email, '')), '') is null then
    raise exception 'family_link_email_required';
  end if;

  select *
  into target_profile
  from public.profiles
  where lower(coalesce(email, '')) = lower(btrim(target_email))
    and lower(coalesce(role, '')) = 'responsavel'
  limit 1;

  if target_profile.id is null then
    raise exception 'family_link_target_not_found';
  end if;

  if target_profile.id = actor_id then
    raise exception 'family_link_self_not_allowed';
  end if;

  actor_family_id := public.ensure_profile_family_id(actor_id);
  target_family_id := public.ensure_profile_family_id(target_profile.id);
  merged_family_id := actor_family_id;

  if target_family_id is distinct from actor_family_id then
    update public.profiles
    set family_id = merged_family_id
    where family_id = target_family_id
      and lower(coalesce(role, '')) = 'responsavel';
  end if;

  update public.profiles
  set family_id = merged_family_id
  where id in (actor_id, target_profile.id);

  with family_members as (
    select id, public.normalize_student_duplicate_text(name) as normalized_name
    from public.profiles
    where family_id = merged_family_id
      and lower(coalesce(role, '')) = 'responsavel'
  ),
  family_students as (
    select distinct s.id
    from public.students s
    left join public.student_guardians sg on sg.student_id = s.id
    left join family_members linked_member on linked_member.id = sg.guardian_id
    left join family_members named_member
      on named_member.normalized_name = public.normalize_student_duplicate_text(s.primary_guardian_name)
    where linked_member.id is not null
       or named_member.id is not null
  )
  insert into public.student_guardians (student_id, guardian_id)
  select fs.id, fm.id
  from family_students fs
  cross join family_members fm
  on conflict do nothing;

  select count(*) into member_count
  from public.profiles
  where family_id = merged_family_id
    and lower(coalesce(role, '')) = 'responsavel';

  select count(distinct sg.student_id) into student_count
  from public.student_guardians sg
  join public.profiles p on p.id = sg.guardian_id
  where p.family_id = merged_family_id
    and lower(coalesce(p.role, '')) = 'responsavel';

  return jsonb_build_object(
    'ok', true,
    'family_id', merged_family_id,
    'linked_responsible_id', target_profile.id,
    'linked_responsible_name', target_profile.name,
    'member_count', member_count,
    'student_count', student_count
  );
end;
$$;

create or replace function public.accept_invite_token(
  invite_token text,
  target_email text,
  expected_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  invite_record record;
  normalized_expected text := lower(btrim(coalesce(expected_role, '')));
  actor_family_id uuid;
  inviter_family_id uuid;
  merged_family_id uuid;
  inserted_count integer := 0;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into invite_record
  from public.invites
  where token = invite_token
  limit 1;

  if invite_record.id is null then
    raise exception 'invite_not_found';
  end if;

  if invite_record.status is distinct from 'pending' then
    raise exception 'invite_already_used';
  end if;

  if invite_record.expires_at < now() then
    update public.invites
    set status = 'expired'
    where id = invite_record.id;
    raise exception 'invite_expired';
  end if;

  if lower(invite_record.email) <> lower(btrim(coalesce(target_email, ''))) then
    raise exception 'invite_email_mismatch';
  end if;

  if normalized_expected <> '' and lower(invite_record.role) <> normalized_expected then
    raise exception 'invite_role_mismatch';
  end if;

  update public.invites
  set status = 'accepted',
      accepted_at = now()
  where id = invite_record.id;

  if lower(invite_record.role) = 'responsavel' and invite_record.created_by is not null then
    actor_family_id := public.ensure_profile_family_id(actor_id);
    inviter_family_id := public.ensure_profile_family_id(invite_record.created_by);
    merged_family_id := coalesce(inviter_family_id, actor_family_id);

    update public.profiles
    set family_id = merged_family_id
    where lower(coalesce(role, '')) = 'responsavel'
      and (family_id = actor_family_id or id = actor_id);

    update public.profiles
    set family_id = merged_family_id
    where id = invite_record.created_by
      and lower(coalesce(role, '')) = 'responsavel';

    with family_members as (
      select id, public.normalize_student_duplicate_text(name) as normalized_name
      from public.profiles
      where family_id = merged_family_id
        and lower(coalesce(role, '')) = 'responsavel'
    ),
    family_students as (
      select distinct s.id
      from public.students s
      left join public.student_guardians sg on sg.student_id = s.id
      left join family_members linked_member on linked_member.id = sg.guardian_id
      left join family_members named_member
        on named_member.normalized_name = public.normalize_student_duplicate_text(s.primary_guardian_name)
      where linked_member.id is not null
         or named_member.id is not null
    )
    insert into public.student_guardians (student_id, guardian_id)
    select fs.id, fm.id
    from family_students fs
    cross join family_members fm
    on conflict do nothing;

    get diagnostics inserted_count = row_count;
  end if;

  return jsonb_build_object(
    'ok', true,
    'role', invite_record.role,
    'family_links_created', inserted_count
  );
end;
$$;

create or replace function public.get_invite_meta(invite_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record record;
begin
  select id, email, role, status, expires_at
  into invite_record
  from public.invites
  where token = invite_token
  limit 1;

  if invite_record.id is null then
    raise exception 'invite_not_found';
  end if;

  return jsonb_build_object(
    'id', invite_record.id,
    'email', invite_record.email,
    'role', invite_record.role,
    'status', invite_record.status,
    'expires_at', invite_record.expires_at
  );
end;
$$;

revoke all on function public.ensure_profile_family_id(uuid) from public;
revoke all on function public.sync_student_family_guardians(uuid, uuid) from public;
revoke all on function public.get_my_family_network() from public;
revoke all on function public.link_family_responsible(text) from public;
revoke all on function public.accept_invite_token(text, text, text) from public;
revoke all on function public.get_invite_meta(text) from public;

grant execute on function public.sync_student_family_guardians(uuid, uuid) to authenticated;
grant execute on function public.get_my_family_network() to authenticated;
grant execute on function public.link_family_responsible(text) to authenticated;
grant execute on function public.accept_invite_token(text, text, text) to authenticated;
grant execute on function public.get_invite_meta(text) to anon, authenticated;

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
  owned_student_ids uuid[] := array[]::uuid[];
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
    coalesce(array_agg(distinct s.id), array[]::uuid[]),
    coalesce(array_agg(distinct s.name), array[]::text[])
    into owned_student_ids, deleted_children
  from public.students s
  where exists (
      select 1
      from public.student_guardians sg
      where sg.student_id = s.id
        and sg.guardian_id = target_profile_id
    )
    or (
      lower(coalesce(target_profile.role, '')) = 'responsavel'
      and public.normalize_student_duplicate_text(s.primary_guardian_name) =
        public.normalize_student_duplicate_text(target_profile.name)
    );

  if coalesce(array_length(owned_student_ids, 1), 0) > 0 then
    delete from public.print_jobs
    where checkin_id in (
      select c.id
      from public.checkins c
      where c.student_id = any(owned_student_ids)
    );

    delete from public.checkins
    where student_id = any(owned_student_ids)
       or actor_id = target_profile_id;

    delete from public.audit_logs
    where actor_id = target_profile_id
       or target_id = target_profile_id
       or target_id = any(owned_student_ids);

    delete from public.student_guardians
    where student_id = any(owned_student_ids)
       or guardian_id = target_profile_id;

    delete from public.students
    where id = any(owned_student_ids);
  else
    delete from public.checkins
    where actor_id = target_profile_id;

    delete from public.audit_logs
    where actor_id = target_profile_id
       or target_id = target_profile_id;

    delete from public.student_guardians
    where guardian_id = target_profile_id;
  end if;

  delete from public.tip_reads
  where user_id = target_profile_id;

  delete from public.tips
  where recipient_id = target_profile_id
     or created_by = target_profile_id;

  delete from public.schedules
  where profile_id = target_profile_id
     or created_by = target_profile_id
     or lower(btrim(coalesce(target_user, ''))) in (
       lower(btrim(coalesce(target_profile.name, ''))),
       lower(btrim(coalesce(target_profile.email, '')))
     );

  delete from public.invites
  where created_by = target_profile_id
     or lower(btrim(coalesce(email, ''))) = lower(btrim(coalesce(target_profile.email, '')));

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
    'deleted_primary_student_ids', coalesce(owned_student_ids, array[]::uuid[]),
    'deleted_student_ids', coalesce(owned_student_ids, array[]::uuid[])
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

drop policy if exists audit_logs_select_staff on public.audit_logs;
create policy audit_logs_select_staff on public.audit_logs
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe', 'dnms_kids')
  )
  or lower(coalesce((select p.email from public.profiles p where p.id = auth.uid()), '')) = 'marvinlabre@gmail.com'
);

drop policy if exists audit_logs_insert_authenticated on public.audit_logs;
create policy audit_logs_insert_authenticated on public.audit_logs
for insert to authenticated
with check (auth.uid() = actor_id);

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

drop policy if exists invites_insert_family_responsible on public.invites;
create policy invites_insert_family_responsible on public.invites
for insert to authenticated
with check (
  role = 'responsavel'
  and created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'responsavel'
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

drop policy if exists tips_delete_admin on public.tips;
create policy tips_delete_admin on public.tips
for delete to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or lower(coalesce(p.email, '')) = 'marvinlabre@gmail.com'
      )
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

drop policy if exists tip_reads_delete_admin on public.tip_reads;
create policy tip_reads_delete_admin on public.tip_reads
for delete to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or lower(coalesce(p.email, '')) = 'marvinlabre@gmail.com'
      )
  )
);

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

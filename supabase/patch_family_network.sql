-- Rede familiar de responsaveis.
-- Permite que um responsavel vincule outro responsavel por email e que todos
-- os responsaveis da rede compartilhem as mesmas criancas.

alter table public.profiles
  add column if not exists family_id uuid null;

update public.profiles
set family_id = id
where family_id is null
  and lower(coalesce(role, '')) = 'responsavel';

create index if not exists idx_profiles_family_id on public.profiles (family_id);

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

revoke all on function public.ensure_profile_family_id(uuid) from public;
revoke all on function public.sync_student_family_guardians(uuid, uuid) from public;
revoke all on function public.get_my_family_network() from public;
revoke all on function public.link_family_responsible(text) from public;

grant execute on function public.sync_student_family_guardians(uuid, uuid) to authenticated;
grant execute on function public.get_my_family_network() to authenticated;
grant execute on function public.link_family_responsible(text) to authenticated;

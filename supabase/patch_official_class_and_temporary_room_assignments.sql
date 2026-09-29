-- DNMS Check-in: separa classificacao automatica, turma oficial e alocacao temporaria por evento.
-- Execute no Supabase SQL Editor do projeto correto.

alter table public.students
  add column if not exists official_class_name text null;

create table if not exists public.temporary_room_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  reason text null,
  created_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id, room_id)
);

alter table public.temporary_room_assignments enable row level security;

create or replace function public.get_student_official_class_for_date(
  target_student_id uuid,
  reference_date date default current_date
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(btrim(s.official_class_name), ''), public.get_student_class_for_birth_year(s.birth_date, reference_date))
  from public.students s
  where s.id = target_student_id
$$;

create or replace function public.get_student_temporary_room_for_date(
  target_student_id uuid,
  event_date date
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tra.room_id
  from public.temporary_room_assignments tra
  join public.rooms r on r.id = tra.room_id
  where tra.student_id = target_student_id
    and r.date = event_date
  order by tra.created_at desc
  limit 1
$$;

create or replace function public.get_student_effective_class_for_room(
  target_student_id uuid,
  target_room_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.temporary_room_assignments tra
      where tra.student_id = target_student_id
        and tra.room_id = target_room_id
    )
    then r.class_target
    else public.get_student_official_class_for_date(target_student_id, r.date)
  end
  from public.rooms r
  where r.id = target_room_id
$$;

create or replace function public.sync_student_class_name_from_birth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.class_name := public.get_student_class_for_birth_year(new.birth_date, current_date);
  return new;
end;
$$;

drop trigger if exists sync_student_class_name_from_birth_trigger on public.students;
create trigger sync_student_class_name_from_birth_trigger
before insert or update of birth_date, class_name on public.students
for each row execute function public.sync_student_class_name_from_birth();

create or replace function public.prevent_checkin_outside_student_age_range()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  room_date date;
  room_class text;
  temporary_room_id uuid;
  effective_class text;
begin
  select r.date, r.class_target
    into room_date, room_class
    from public.rooms r
   where r.id = new.room_id
   limit 1;

  if room_date is null then
    return new;
  end if;

  temporary_room_id := public.get_student_temporary_room_for_date(new.student_id, room_date);
  effective_class := public.get_student_effective_class_for_room(new.student_id, new.room_id);

  if temporary_room_id is not null and temporary_room_id is distinct from new.room_id then
    raise exception 'student_temporary_room_mismatch';
  end if;

  if temporary_room_id is null and effective_class = 'Fora da faixa' then
    raise exception 'student_age_out_of_range';
  end if;

  if room_class is distinct from effective_class then
    raise exception 'student_class_mismatch_for_effective_room';
  end if;

  new.class_name := effective_class;
  return new;
end;
$$;

drop trigger if exists prevent_checkin_outside_student_age_range_trigger on public.checkins;
create trigger prevent_checkin_outside_student_age_range_trigger
before insert or update of student_id, room_id on public.checkins
for each row execute function public.prevent_checkin_outside_student_age_range();

create or replace function public.parent_checkin_with_presence(
  target_student_id uuid,
  presence_token text
)
returns table (
  id uuid,
  room_id uuid,
  room_name_snapshot text,
  student_id uuid,
  class_name text,
  notes_snapshot text,
  checked_in_at timestamptz,
  checked_out_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor_profile public.profiles%rowtype;
  target_student public.students%rowtype;
  target_room public.rooms%rowtype;
  temporary_room_id uuid;
  effective_class text;
  expected_hash text;
  token_hash text;
  inserted_checkin public.checkins%rowtype;
begin
  select * into actor_profile from public.profiles where profiles.id = auth.uid() limit 1;

  if actor_profile.id is null or actor_profile.role <> 'responsavel' then
    raise exception 'Somente responsavel pode usar check-in com QR.';
  end if;

  select value into expected_hash from public.app_settings where key = 'parent_checkin_presence_sha256' limit 1;

  token_hash := encode(digest(convert_to(btrim(coalesce(presence_token, '')), 'UTF8'), 'sha256'), 'hex');
  if expected_hash is null or token_hash <> expected_hash then
    raise exception 'QR Code de presenca invalido.';
  end if;

  select * into target_student from public.students where students.id = target_student_id limit 1;

  if target_student.id is null then
    raise exception 'Aluno nao encontrado.';
  end if;

  if not exists (
    select 1 from public.student_guardians sg
    where sg.student_id = target_student.id
      and sg.guardian_id = actor_profile.id
  ) then
    raise exception 'Sem permissao para check-in deste aluno.';
  end if;

  if exists (
    select 1 from public.checkins c
    where c.student_id = target_student.id
      and c.checked_out_at is null
  ) then
    raise exception 'Este aluno ja possui um check-in ativo.';
  end if;

  temporary_room_id := (
    select tra.room_id
    from public.temporary_room_assignments tra
    join public.rooms r on r.id = tra.room_id
    where tra.student_id = target_student.id
      and r.status = 'Aberta'
      and public.is_room_checkin_window_open(r.id, now())
    order by r.date asc, coalesce(r.start_time, r.time) asc nulls last, tra.created_at desc
    limit 1
  );

  if temporary_room_id is not null then
    select * into target_room from public.rooms where rooms.id = temporary_room_id limit 1;
  else
    effective_class := public.get_student_official_class_for_date(target_student.id, current_date);
    select *
      into target_room
      from public.rooms
     where rooms.status = 'Aberta'
       and rooms.class_target = effective_class
       and (
         rooms.max_checkins is null
         or (
           select count(*)::integer
             from public.checkins c
            where c.room_id = rooms.id
              and c.checked_out_at is null
         ) < rooms.max_checkins
       )
     order by
       case when public.is_room_checkin_window_open(rooms.id, now()) then 0 else 1 end,
       rooms.date asc,
       coalesce(rooms.start_time, rooms.time) asc nulls last,
       rooms.opened_at asc nulls last
     limit 1;
  end if;

  if target_room.id is null then
    raise exception 'Nao ha sala aberta para a turma deste aluno.';
  end if;

  if not public.is_room_checkin_window_open(target_room.id, now()) then
    raise exception 'Horario de check-in encerrado para esta aula.';
  end if;

  if target_room.max_checkins is not null and (
    select count(*)::integer
    from public.checkins c
    where c.room_id = target_room.id
      and c.checked_out_at is null
  ) >= target_room.max_checkins then
    raise exception 'room_checkin_limit_reached';
  end if;

  insert into public.checkins (
    student_id,
    room_id,
    room_name_snapshot,
    class_name,
    actor_id,
    notes_snapshot
  )
  values (
    target_student.id,
    target_room.id,
    target_room.name,
    public.get_student_effective_class_for_room(target_student.id, target_room.id),
    actor_profile.id,
    coalesce(target_student.notes, '')
  )
  returning * into inserted_checkin;

  return query
  select
    inserted_checkin.id,
    inserted_checkin.room_id,
    inserted_checkin.room_name_snapshot,
    inserted_checkin.student_id,
    inserted_checkin.class_name,
    inserted_checkin.notes_snapshot,
    inserted_checkin.checked_in_at,
    inserted_checkin.checked_out_at;
end;
$$;

drop policy if exists temporary_room_assignments_select_staff on public.temporary_room_assignments;
create policy temporary_room_assignments_select_staff on public.temporary_room_assignments
for select using (public.is_staff_user(auth.uid()));

drop policy if exists temporary_room_assignments_insert_admin on public.temporary_room_assignments;
create policy temporary_room_assignments_insert_admin on public.temporary_room_assignments
for insert with check (public.is_admin_family_network_manager(auth.uid()));

drop policy if exists temporary_room_assignments_delete_admin on public.temporary_room_assignments;
create policy temporary_room_assignments_delete_admin on public.temporary_room_assignments
for delete using (public.is_admin_family_network_manager(auth.uid()));

revoke all on function public.get_student_official_class_for_date(uuid, date) from public;
revoke all on function public.get_student_temporary_room_for_date(uuid, date) from public;
revoke all on function public.get_student_effective_class_for_room(uuid, uuid) from public;
revoke all on function public.parent_checkin_with_presence(uuid, text) from public;

grant execute on function public.get_student_official_class_for_date(uuid, date) to authenticated;
grant execute on function public.get_student_temporary_room_for_date(uuid, date) to authenticated;
grant execute on function public.get_student_effective_class_for_room(uuid, uuid) to authenticated;
grant execute on function public.parent_checkin_with_presence(uuid, text) to authenticated;

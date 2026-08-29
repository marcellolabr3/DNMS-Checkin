create or replace function public.get_student_class_for_birth_year(
  birth_date date,
  reference_date date default current_date
)
returns text
language sql
stable
as $$
  select case
    when birth_date is null or reference_date is null then 'Indefinida'
    when extract(year from reference_date)::int - extract(year from birth_date)::int between 2 and 3 then 'Maternal'
    when extract(year from reference_date)::int - extract(year from birth_date)::int between 4 and 6 then 'Kids'
    when extract(year from reference_date)::int - extract(year from birth_date)::int between 7 and 10 then 'Juniors'
    when extract(year from reference_date)::int - extract(year from birth_date)::int between 11 and 15 then 'Teens'
    else 'Fora da faixa'
  end
$$;

create or replace function public.prevent_checkin_outside_student_age_range()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student_birth date;
  room_date date;
  room_class text;
  expected_class text;
begin
  select s.birth_date
    into student_birth
    from public.students s
   where s.id = new.student_id
   limit 1;

  select r.date, r.class_target
    into room_date, room_class
    from public.rooms r
   where r.id = new.room_id
   limit 1;

  if student_birth is null or room_date is null then
    return new;
  end if;

  expected_class := public.get_student_class_for_birth_year(student_birth, room_date);

  if expected_class = 'Fora da faixa' then
    raise exception 'student_age_out_of_range';
  end if;

  if room_class is distinct from expected_class then
    raise exception 'student_class_mismatch_for_age';
  end if;

  new.class_name := expected_class;
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
  expected_hash text;
  token_hash text;
  expected_class text;
  inserted_checkin public.checkins%rowtype;
begin
  select *
    into actor_profile
    from public.profiles
   where profiles.id = auth.uid()
   limit 1;

  if actor_profile.id is null or actor_profile.role <> 'responsavel' then
    raise exception 'Somente responsavel pode usar check-in com QR.';
  end if;

  select value
    into expected_hash
    from public.app_settings
   where key = 'parent_checkin_presence_sha256'
   limit 1;

  token_hash := encode(digest(convert_to(btrim(coalesce(presence_token, '')), 'UTF8'), 'sha256'), 'hex');
  if expected_hash is null or token_hash <> expected_hash then
    raise exception 'QR Code de presenca invalido.';
  end if;

  select *
    into target_student
    from public.students
   where students.id = target_student_id
   limit 1;

  if target_student.id is null then
    raise exception 'Aluno nao encontrado.';
  end if;

  if not exists (
    select 1
      from public.student_guardians sg
     where sg.student_id = target_student.id
       and sg.guardian_id = actor_profile.id
  ) then
    raise exception 'Sem permissao para check-in deste aluno.';
  end if;

  select *
    into target_room
    from public.rooms
   where rooms.status = 'Aberta'
     and rooms.class_target = public.get_student_class_for_birth_year(target_student.birth_date, rooms.date)
   order by
     case when public.is_room_checkin_window_open(rooms.id, now()) then 0 else 1 end,
     rooms.date asc,
     coalesce(rooms.start_time, rooms.time) asc nulls last,
     rooms.opened_at asc nulls last
   limit 1;

  if target_room.id is null then
    raise exception 'Nao ha sala aberta para a turma deste aluno.';
  end if;

  if not public.is_room_checkin_window_open(target_room.id, now()) then
    raise exception 'Horario de check-in encerrado para esta aula.';
  end if;

  expected_class := public.get_student_class_for_birth_year(target_student.birth_date, target_room.date);
  if expected_class = 'Fora da faixa' then
    raise exception 'student_age_out_of_range';
  end if;

  if exists (
    select 1
      from public.checkins c
     where c.student_id = target_student.id
       and c.checked_out_at is null
  ) then
    raise exception 'Este aluno ja possui um check-in ativo.';
  end if;

  if exists (
    select 1
      from public.checkins c
     where c.student_id = target_student.id
       and c.room_id = target_room.id
  ) then
    raise exception 'Este aluno ja fez check-in nesta sala.';
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
    expected_class,
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

revoke all on function public.prevent_checkin_outside_student_age_range() from public;
revoke all on function public.parent_checkin_with_presence(uuid, text) from public;
grant execute on function public.parent_checkin_with_presence(uuid, text) to authenticated;

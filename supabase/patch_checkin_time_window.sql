-- Limita check-in ao intervalo de 30 minutos antes do inicio ate antes do horario de termino.

create or replace function public.is_room_checkin_window_open(
  target_room_id uuid,
  checked_at timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room public.rooms%rowtype;
  local_checked_at timestamp;
  start_value text;
  end_value text;
  start_time_value time;
  end_time_value time;
  checkin_opens_at timestamp;
  checkin_ends_at timestamp;
begin
  if target_room_id is null then
    return false;
  end if;

  select *
    into target_room
    from public.rooms
   where id = target_room_id
   limit 1;

  if target_room.id is null or target_room.status <> 'Aberta' then
    return false;
  end if;

  start_value := coalesce(nullif(btrim(target_room.start_time), ''), nullif(btrim(target_room.time), ''));
  end_value := nullif(btrim(target_room.end_time), '');

  if start_value is null or end_value is null then
    return false;
  end if;

  if start_value !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' or end_value !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' then
    return false;
  end if;

  start_time_value := start_value::time;
  end_time_value := end_value::time;

  if end_time_value <= start_time_value then
    return false;
  end if;

  local_checked_at := timezone('America/Sao_Paulo', coalesce(checked_at, now()));
  checkin_opens_at := target_room.date::timestamp + start_time_value - interval '30 minutes';
  checkin_ends_at := target_room.date::timestamp + end_time_value;

  return local_checked_at >= checkin_opens_at
    and local_checked_at < checkin_ends_at;
end;
$$;

create or replace function public.prevent_checkin_outside_room_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_checkin_window_open(new.room_id, coalesce(new.checked_in_at, now())) then
    raise exception 'checkin_window_closed'
      using errcode = 'P0001',
        detail = 'Check-in permitido somente de 30 minutos antes do inicio ate antes do horario de termino da aula.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_checkin_outside_room_window_trigger on public.checkins;
create trigger prevent_checkin_outside_room_window_trigger
before insert on public.checkins
for each row execute function public.prevent_checkin_outside_room_window();

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
     and rooms.class_target = target_student.class_name
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
    target_student.class_name,
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

revoke all on function public.is_room_checkin_window_open(uuid, timestamptz) from public;
revoke all on function public.prevent_checkin_outside_room_window() from public;
revoke all on function public.parent_checkin_with_presence(uuid, text) from public;

grant execute on function public.is_room_checkin_window_open(uuid, timestamptz) to authenticated;
grant execute on function public.parent_checkin_with_presence(uuid, text) to authenticated;

notify pgrst, 'reload schema';

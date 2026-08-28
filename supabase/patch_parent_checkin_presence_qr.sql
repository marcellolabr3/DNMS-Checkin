create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.rooms
  add column if not exists start_time text null,
  add column if not exists end_time text null;

alter table public.checkins
  add column if not exists room_name_snapshot text null;

alter table public.app_settings enable row level security;

revoke all on public.app_settings from anon, authenticated;

insert into public.app_settings (key, value)
values ('parent_checkin_presence_sha256', 'af0677fd4e01a3eef4ecba9dbd15fbcc5e279c74615482d5e68d61d31976a94f')
on conflict (key) do nothing;

drop policy if exists checkins_insert_staff_or_guardian on public.checkins;
drop policy if exists checkins_insert_staff_only on public.checkins;
create policy checkins_insert_staff_only on public.checkins
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe')
  )
);

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
   order by rooms.date asc, coalesce(rooms.start_time, rooms.time) asc nulls last, rooms.opened_at asc nulls last
   limit 1;

  if target_room.id is null then
    raise exception 'Nao ha sala aberta para a turma deste aluno.';
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

revoke all on function public.parent_checkin_with_presence(uuid, text) from public;
grant execute on function public.parent_checkin_with_presence(uuid, text) to authenticated;

notify pgrst, 'reload schema';

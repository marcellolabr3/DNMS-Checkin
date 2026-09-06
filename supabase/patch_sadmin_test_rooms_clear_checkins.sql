-- DNMS Check-in: salas teste e limpeza SADMIN de check-ins do dia.
-- Execute no Supabase SQL Editor do projeto correto.

alter table public.rooms
  add column if not exists is_test boolean not null default false;

create index if not exists idx_rooms_is_test_date on public.rooms (is_test, date);

create or replace function public.is_sadmin_user(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and lower(coalesce(p.email, '')) = 'marvinlabre@gmail.com'
  );
$$;

grant execute on function public.is_sadmin_user(uuid) to authenticated;

create or replace function public.enforce_room_test_sadmin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and coalesce(new.is_test, false) and not public.is_sadmin_user(auth.uid()) then
    raise exception 'sadmin_required_for_test_room';
  end if;

  if tg_op = 'UPDATE'
     and coalesce(new.is_test, false) is distinct from coalesce(old.is_test, false)
     and not public.is_sadmin_user(auth.uid()) then
    raise exception 'sadmin_required_for_test_room';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_room_test_sadmin_trigger on public.rooms;
create trigger enforce_room_test_sadmin_trigger
before insert or update of is_test on public.rooms
for each row execute function public.enforce_room_test_sadmin();

create or replace function public.sadmin_clear_today_checkins()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_profile public.profiles%rowtype;
  local_today date := timezone('America/Sao_Paulo', now())::date;
  start_at timestamptz := local_today::timestamp at time zone 'America/Sao_Paulo';
  end_at timestamptz := (local_today + 1)::timestamp at time zone 'America/Sao_Paulo';
  deleted_checkin_ids uuid[];
  deleted_checkins integer := 0;
  deleted_audit_logs integer := 0;
begin
  if actor_id is null or not public.is_sadmin_user(actor_id) then
    raise exception 'sadmin_required';
  end if;

  select * into actor_profile
  from public.profiles
  where id = actor_id
  limit 1;

  select coalesce(array_agg(c.id), array[]::uuid[])
    into deleted_checkin_ids
    from public.checkins c
   where c.checked_in_at >= start_at
     and c.checked_in_at < end_at;

  delete from public.audit_logs a
   where a.target_type = 'checkin'
     and a.target_id = any(deleted_checkin_ids);
  get diagnostics deleted_audit_logs = row_count;

  delete from public.checkins c
   where c.id = any(deleted_checkin_ids);
  get diagnostics deleted_checkins = row_count;

  insert into public.audit_logs (
    actor_id,
    actor_name,
    actor_role,
    action_type,
    target_type,
    target_name,
    details,
    metadata
  )
  values (
    actor_id,
    coalesce(actor_profile.name, actor_profile.email, ''),
    coalesce(actor_profile.role, ''),
    'checkins_cleared',
    'checkin',
    'Check-ins de hoje',
    'SADMIN zerou os check-ins do dia.',
    jsonb_build_object(
      'date', local_today,
      'deleted_checkins', deleted_checkins,
      'deleted_audit_logs', deleted_audit_logs
    )
  );

  return jsonb_build_object(
    'ok', true,
    'date', local_today,
    'deleted_checkins', deleted_checkins,
    'deleted_audit_logs', deleted_audit_logs
  );
end;
$$;

revoke all on function public.enforce_room_test_sadmin() from public;
revoke all on function public.sadmin_clear_today_checkins() from public;
grant execute on function public.sadmin_clear_today_checkins() to authenticated;

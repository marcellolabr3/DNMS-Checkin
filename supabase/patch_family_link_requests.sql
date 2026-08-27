-- Solicitacoes internas de vinculo familiar entre responsaveis.
-- O vinculo so e aplicado depois que o responsavel convidado aceita no app.

delete from public.invites
where lower(coalesce(role, '')) = 'responsavel';

alter table public.invites
  drop constraint if exists invites_role_check;

alter table public.invites
  add constraint invites_role_check
  check (role in ('dnms_kids', 'equipe', 'admin'));

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

  return jsonb_build_object('ok', true, 'role', invite_record.role);
end;
$$;

create table if not exists public.family_link_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  requester_name_snapshot text not null default '',
  target_name_snapshot text not null default '',
  tip_id uuid null references public.tips (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  responded_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_family_link_requests_target_status
  on public.family_link_requests (target_id, status, expires_at desc);

create index if not exists idx_family_link_requests_requester_status
  on public.family_link_requests (requester_id, status, expires_at desc);

create unique index if not exists family_link_requests_one_pending_pair
  on public.family_link_requests (requester_id, target_id)
  where status = 'pending';

alter table public.family_link_requests enable row level security;

alter table public.family_link_requests
  add column if not exists requester_name_snapshot text not null default '',
  add column if not exists target_name_snapshot text not null default '';

drop policy if exists family_link_requests_select_own on public.family_link_requests;
create policy family_link_requests_select_own on public.family_link_requests
for select to authenticated
using (
  requester_id = auth.uid()
  or target_id = auth.uid()
  or public.is_staff_user(auth.uid())
);

drop policy if exists family_link_requests_no_direct_insert on public.family_link_requests;
create policy family_link_requests_no_direct_insert on public.family_link_requests
for insert to authenticated
with check (false);

drop policy if exists family_link_requests_no_direct_update on public.family_link_requests;
create policy family_link_requests_no_direct_update on public.family_link_requests
for update to authenticated
using (false)
with check (false);

create or replace function public.apply_family_link_between_responsibles(
  requester uuid,
  target uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_family_id uuid;
  target_family_id uuid;
  merged_family_id uuid;
  member_count integer := 0;
  student_count integer := 0;
begin
  requester_family_id := public.ensure_profile_family_id(requester);
  target_family_id := public.ensure_profile_family_id(target);
  merged_family_id := requester_family_id;

  if target_family_id is distinct from requester_family_id then
    update public.profiles
    set family_id = merged_family_id
    where family_id = target_family_id
      and lower(coalesce(role, '')) = 'responsavel';
  end if;

  update public.profiles
  set family_id = merged_family_id
  where id in (requester, target)
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
    'member_count', member_count,
    'student_count', student_count
  );
end;
$$;

create or replace function public.request_family_link(target_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_profile record;
  target_profile record;
  existing_request record;
  request_id uuid;
  message_id uuid;
  expiration timestamptz := now() + interval '7 days';
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into actor_profile
  from public.profiles
  where id = actor_id;

  if actor_profile.id is null or lower(coalesce(actor_profile.role, '')) <> 'responsavel' then
    raise exception 'family_link_only_responsavel';
  end if;

  if nullif(btrim(coalesce(target_email, '')), '') is null then
    raise exception 'family_link_email_required';
  end if;

  select * into target_profile
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

  if coalesce(actor_profile.family_id, actor_profile.id) = coalesce(target_profile.family_id, target_profile.id)
     and actor_profile.family_id is not null
     and target_profile.family_id is not null then
    return jsonb_build_object(
      'ok', true,
      'status', 'already_linked',
      'target_id', target_profile.id,
      'target_name', target_profile.name
    );
  end if;

  update public.family_link_requests
  set status = 'expired'
  where status = 'pending'
    and expires_at < now();

  select * into existing_request
  from public.family_link_requests
  where requester_id = actor_id
    and target_id = target_profile.id
    and status = 'pending'
    and expires_at >= now()
  limit 1;

  if existing_request.id is not null then
    return jsonb_build_object(
      'ok', true,
      'status', 'pending',
      'request_id', existing_request.id,
      'target_id', target_profile.id,
      'target_name', target_profile.name,
      'expires_at', existing_request.expires_at
    );
  end if;

  insert into public.family_link_requests (
    requester_id,
    target_id,
    requester_name_snapshot,
    target_name_snapshot,
    status,
    expires_at
  )
  values (
    actor_id,
    target_profile.id,
    coalesce(actor_profile.name, ''),
    coalesce(target_profile.name, ''),
    'pending',
    expiration
  )
  returning id into request_id;

  insert into public.tips (message, recipient_id, created_by, sender_name)
  values (
    coalesce(actor_profile.name, 'Um responsavel') || ' te adicionou a sua familia! Deseja aceitar?',
    target_profile.id,
    actor_id,
    coalesce(actor_profile.name, '')
  )
  returning id into message_id;

  update public.family_link_requests
  set tip_id = message_id
  where id = request_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'pending',
    'request_id', request_id,
    'target_id', target_profile.id,
    'target_name', target_profile.name,
    'tip_id', message_id,
    'expires_at', expiration
  );
end;
$$;

create or replace function public.respond_family_link_request(
  request_id uuid,
  accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  request_record record;
  requester_profile record;
  target_profile record;
  link_result jsonb := '{}'::jsonb;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into request_record
  from public.family_link_requests
  where id = request_id;

  if request_record.id is null then
    raise exception 'family_link_request_not_found';
  end if;

  if request_record.target_id <> actor_id then
    raise exception 'family_link_request_not_allowed';
  end if;

  if request_record.status is distinct from 'pending' then
    raise exception 'family_link_request_not_pending';
  end if;

  select * into requester_profile from public.profiles where id = request_record.requester_id;
  select * into target_profile from public.profiles where id = request_record.target_id;

  if request_record.expires_at < now() then
    update public.family_link_requests
    set status = 'expired',
        responded_at = now()
    where id = request_record.id;
    raise exception 'family_link_request_expired';
  end if;

  if not accept then
    update public.family_link_requests
    set status = 'declined',
        responded_at = now()
    where id = request_record.id;

    insert into public.tips (message, recipient_id, created_by, sender_name)
    values (
      coalesce(target_profile.name, 'O responsavel') || ' recusou o vinculo familiar.',
      request_record.requester_id,
      actor_id,
      coalesce(target_profile.name, '')
    );

    return jsonb_build_object(
      'ok', true,
      'status', 'declined',
      'requester_name', requester_profile.name,
      'target_name', target_profile.name
    );
  end if;

  link_result := public.apply_family_link_between_responsibles(request_record.requester_id, request_record.target_id);

  update public.family_link_requests
  set status = 'accepted',
      responded_at = now()
  where id = request_record.id;

  insert into public.tips (message, recipient_id, created_by, sender_name)
  values
    (
      'Voce esta sendo vinculado a familia de ' || coalesce(requester_profile.name, 'responsavel') || '.',
      request_record.target_id,
      request_record.requester_id,
      coalesce(requester_profile.name, '')
    ),
    (
      coalesce(target_profile.name, 'Responsavel') || ' aceitou entrar na sua rede familiar.',
      request_record.requester_id,
      request_record.target_id,
      coalesce(target_profile.name, '')
    );

  return jsonb_build_object(
    'ok', true,
    'status', 'accepted',
    'requester_name', requester_profile.name,
    'target_name', target_profile.name,
    'family_id', link_result->>'family_id',
    'member_count', coalesce((link_result->>'member_count')::integer, 0),
    'student_count', coalesce((link_result->>'student_count')::integer, 0)
  );
end;
$$;

create or replace function public.link_family_responsible(target_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.request_family_link(target_email);
end;
$$;

revoke all on function public.apply_family_link_between_responsibles(uuid, uuid) from public;
revoke all on function public.request_family_link(text) from public;
revoke all on function public.respond_family_link_request(uuid, boolean) from public;
revoke all on function public.link_family_responsible(text) from public;
revoke all on function public.get_invite_meta(text) from public;
revoke all on function public.accept_invite_token(text, text, text) from public;
grant execute on function public.request_family_link(text) to authenticated;
grant execute on function public.respond_family_link_request(uuid, boolean) to authenticated;
grant execute on function public.link_family_responsible(text) to authenticated;
grant execute on function public.get_invite_meta(text) to anon, authenticated;
grant execute on function public.accept_invite_token(text, text, text) to authenticated;

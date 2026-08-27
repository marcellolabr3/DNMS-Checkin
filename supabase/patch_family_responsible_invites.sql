-- Convites de rede familiar para responsaveis.
-- Permite que um responsavel convide outro responsavel ainda sem cadastro
-- e que o aceite do convite una automaticamente os responsaveis na mesma familia.

alter table public.invites
  drop constraint if exists invites_role_check;

alter table public.invites
  add constraint invites_role_check
  check (role in ('dnms_kids', 'equipe', 'admin', 'responsavel'));

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

revoke all on function public.accept_invite_token(text, text, text) from public;
revoke all on function public.get_invite_meta(text) from public;
grant execute on function public.accept_invite_token(text, text, text) to authenticated;
grant execute on function public.get_invite_meta(text) to anon, authenticated;

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

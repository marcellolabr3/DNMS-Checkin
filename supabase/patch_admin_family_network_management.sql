-- Gestao administrativa da rede familiar pela aba Familias.
-- Admin/SADMIN podem adicionar/remover responsaveis sem passar pelo aceite do responsavel comum.

create or replace function public.is_admin_family_network_manager(actor uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = actor
      and (
        lower(coalesce(p.email, '')) = 'marvinlabre@gmail.com'
        or lower(coalesce(p.role, '')) = 'admin'
      )
  );
$$;

create or replace function public.admin_link_family_responsible(
  anchor_profile_id uuid,
  target_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  anchor_profile record;
  target_profile record;
  result jsonb;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_admin_family_network_manager(actor_id) then
    raise exception 'admin_family_network_not_allowed';
  end if;

  select *
  into anchor_profile
  from public.profiles
  where id = anchor_profile_id
    and lower(coalesce(role, '')) = 'responsavel';

  if anchor_profile.id is null then
    raise exception 'admin_family_anchor_not_found';
  end if;

  select *
  into target_profile
  from public.profiles
  where lower(coalesce(email, '')) = lower(btrim(coalesce(target_email, '')))
    and lower(coalesce(role, '')) = 'responsavel'
  limit 1;

  if target_profile.id is null then
    raise exception 'admin_family_target_not_found';
  end if;

  if target_profile.id = anchor_profile.id then
    raise exception 'admin_family_self_not_allowed';
  end if;

  result := public.apply_family_link_between_responsibles(anchor_profile.id, target_profile.id);

  return result || jsonb_build_object(
    'ok', true,
    'linked_responsible_id', target_profile.id,
    'linked_responsible_name', target_profile.name
  );
end;
$$;

create or replace function public.admin_unlink_family_responsible(target_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_profile record;
  previous_family_id uuid;
  remaining_member_ids uuid[];
  remaining_member_names text[];
  target_name text;
  removed_links integer := 0;
  removed_step integer := 0;
begin
  if actor_id is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_admin_family_network_manager(actor_id) then
    raise exception 'admin_family_network_not_allowed';
  end if;

  select *
  into target_profile
  from public.profiles
  where id = target_profile_id
    and lower(coalesce(role, '')) = 'responsavel';

  if target_profile.id is null then
    raise exception 'admin_family_target_not_found';
  end if;

  previous_family_id := public.ensure_profile_family_id(target_profile.id);
  target_name := public.normalize_student_duplicate_text(target_profile.name);

  select array_agg(id), array_agg(public.normalize_student_duplicate_text(name))
  into remaining_member_ids, remaining_member_names
  from public.profiles
  where id <> target_profile.id
    and family_id = previous_family_id
    and lower(coalesce(role, '')) = 'responsavel';

  if coalesce(array_length(remaining_member_ids, 1), 0) = 0 then
    update public.profiles
    set family_id = target_profile.id
    where id = target_profile.id;

    return jsonb_build_object(
      'ok', true,
      'previous_family_id', previous_family_id,
      'new_family_id', target_profile.id,
      'removed_links', 0
    );
  end if;

  update public.profiles
  set family_id = target_profile.id
  where id = target_profile.id;

  delete from public.student_guardians sg
  using public.students s
  where sg.student_id = s.id
    and sg.guardian_id = target_profile.id
    and public.normalize_student_duplicate_text(s.primary_guardian_name) = any(remaining_member_names);
  get diagnostics removed_links = row_count;

  delete from public.student_guardians sg
  using public.students s
  where sg.student_id = s.id
    and sg.guardian_id = any(remaining_member_ids)
    and public.normalize_student_duplicate_text(s.primary_guardian_name) = target_name;
  get diagnostics removed_step = row_count;
  removed_links := removed_links + removed_step;

  insert into public.student_guardians (student_id, guardian_id)
  select s.id, target_profile.id
  from public.students s
  where public.normalize_student_duplicate_text(s.primary_guardian_name) = target_name
  on conflict do nothing;

  return jsonb_build_object(
    'ok', true,
    'previous_family_id', previous_family_id,
    'new_family_id', target_profile.id,
    'removed_links', removed_links
  );
end;
$$;

revoke all on function public.is_admin_family_network_manager(uuid) from public;
revoke all on function public.admin_link_family_responsible(uuid, text) from public;
revoke all on function public.admin_unlink_family_responsible(uuid) from public;

grant execute on function public.admin_link_family_responsible(uuid, text) to authenticated;
grant execute on function public.admin_unlink_family_responsible(uuid) to authenticated;

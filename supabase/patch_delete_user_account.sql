create or replace function public.delete_user_account(target_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_profile record;
  primary_student_ids uuid[] := array[]::uuid[];
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
    coalesce(array_agg(s.id), array[]::uuid[]),
    coalesce(array_agg(s.name), array[]::text[])
    into primary_student_ids, deleted_children
  from public.students s
  where
    lower(btrim(coalesce(s.primary_guardian_name, ''))) = lower(btrim(coalesce(target_profile.name, '')))
    or (
      nullif(btrim(coalesce(s.primary_guardian_name, '')), '') is null
      and exists (
        select 1
        from public.student_guardians sg
        where sg.student_id = s.id
          and sg.guardian_id = target_profile_id
      )
    );

  if coalesce(array_length(primary_student_ids, 1), 0) > 0 then
    delete from public.checkins
    where student_id = any(primary_student_ids);

    delete from public.student_guardians
    where student_id = any(primary_student_ids);

    delete from public.students
    where id = any(primary_student_ids);
  end if;

  delete from public.student_guardians
  where guardian_id = target_profile_id;

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
    'deleted_primary_student_ids', coalesce(primary_student_ids, array[]::uuid[])
  );
end;
$$;

revoke all on function public.delete_user_account(uuid) from public;
grant execute on function public.delete_user_account(uuid) to authenticated;

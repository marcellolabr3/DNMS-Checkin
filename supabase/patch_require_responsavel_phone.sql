alter table public.profiles
  drop constraint if exists profiles_responsavel_phone_required;

alter table public.profiles
  add constraint profiles_responsavel_phone_required
  check (role <> 'responsavel' or nullif(btrim(phone), '') is not null)
  not valid;

create or replace function public.ensure_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_phone text;
begin
  v_role := coalesce(new.raw_user_meta_data ->> 'desired_role', 'responsavel');
  v_phone := nullif(new.raw_user_meta_data ->> 'phone', '');
  if v_role = 'responsavel' and nullif(btrim(v_phone), '') is null then
    raise exception 'Telefone obrigatorio para responsavel';
  end if;

  insert into public.profiles (id, name, role, email, birth_date, marital_status, phone, is_visitor)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1), 'Usuario'),
    v_role,
    new.email,
    nullif(new.raw_user_meta_data ->> 'birth_date', '')::date,
    nullif(new.raw_user_meta_data ->> 'marital_status', ''),
    v_phone,
    coalesce((new.raw_user_meta_data ->> 'is_visitor')::boolean, false)
  )
  on conflict (id) do update
  set
    name = excluded.name,
    role = excluded.role,
    email = excluded.email,
    birth_date = excluded.birth_date,
    marital_status = excluded.marital_status,
    phone = excluded.phone,
    is_visitor = excluded.is_visitor;
  return new;
end;
$$;

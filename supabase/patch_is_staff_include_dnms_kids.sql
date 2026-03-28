create or replace function public.is_staff_user(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid and p.role in ('admin', 'equipe', 'dnms_kids')
  );
$$;

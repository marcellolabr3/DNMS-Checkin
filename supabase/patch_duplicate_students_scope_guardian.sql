create or replace function public.prevent_duplicate_student_for_guardian()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  duplicate_id uuid;
  duplicate_key text;
begin
  duplicate_key :=
    public.normalize_student_duplicate_text(new.name) || '|' ||
    coalesce(new.birth_date::text, '') || '|' ||
    public.normalize_student_duplicate_text(new.primary_guardian_name);

  perform pg_advisory_xact_lock(hashtext(duplicate_key)::bigint);

  select s.id
  into duplicate_id
  from public.students s
  where s.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and s.birth_date = new.birth_date
    and public.normalize_student_duplicate_text(s.name) = public.normalize_student_duplicate_text(new.name)
    and public.normalize_student_duplicate_text(s.primary_guardian_name) =
      public.normalize_student_duplicate_text(new.primary_guardian_name)
  limit 1;

  if duplicate_id is not null then
    raise exception 'duplicate_student_for_guardian'
      using errcode = '23505',
        detail = 'Esta crianca ja esta cadastrada para este responsavel.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_duplicate_student_for_guardian_trigger on public.students;
create trigger prevent_duplicate_student_for_guardian_trigger
before insert or update of name, birth_date, primary_guardian_name on public.students
for each row execute function public.prevent_duplicate_student_for_guardian();

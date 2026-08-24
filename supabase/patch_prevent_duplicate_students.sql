create or replace function public.normalize_student_duplicate_text(value text)
returns text
language sql
immutable
as $$
  select lower(
    regexp_replace(
      btrim(
        translate(
          coalesce(value, ''),
          'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
          'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
        )
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

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
    coalesce(new.birth_date::text, '');

  perform pg_advisory_xact_lock(hashtext(duplicate_key)::bigint);

  select s.id
  into duplicate_id
  from public.students s
  where s.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and s.birth_date = new.birth_date
    and public.normalize_student_duplicate_text(s.name) = public.normalize_student_duplicate_text(new.name)
  limit 1;

  if duplicate_id is not null then
    raise exception 'duplicate_student'
      using errcode = '23505',
        detail = 'Esta crianca ja esta cadastrada.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_duplicate_student_for_guardian_trigger on public.students;
create trigger prevent_duplicate_student_for_guardian_trigger
before insert or update of name, birth_date on public.students
for each row execute function public.prevent_duplicate_student_for_guardian();

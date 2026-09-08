create or replace function public.sync_student_class_name_from_birth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.class_name := public.get_student_class_for_birth_year(new.birth_date, current_date);
  return new;
end;
$$;

drop trigger if exists sync_student_class_name_from_birth_trigger on public.students;
create trigger sync_student_class_name_from_birth_trigger
before insert or update of birth_date, class_name on public.students
for each row execute function public.sync_student_class_name_from_birth();

update public.students
   set class_name = public.get_student_class_for_birth_year(birth_date, current_date)
 where class_name is distinct from public.get_student_class_for_birth_year(birth_date, current_date);

revoke all on function public.sync_student_class_name_from_birth() from public;

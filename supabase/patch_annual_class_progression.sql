-- DNMS Check-in: progressao anual de turmas.
-- Execute no Supabase SQL Editor do projeto correto apos backup.

create or replace function public.get_student_class_for_birth_year(
  birth_date date,
  reference_date date default current_date
)
returns text
language sql
stable
as $$
  with age_calc as (
    select
      extract(year from reference_date)::int - extract(year from birth_date)::int as class_age,
      date_part('year', age(reference_date, birth_date))::int as current_age
  )
  select case
    when birth_date is null or reference_date is null then 'Indefinida'
    when class_age = 2 and current_age < 2 then 'Fora da faixa'
    when class_age between 2 and 4 then 'Maternal'
    when class_age between 5 and 7 then 'Kids'
    when class_age between 8 and 11 then 'Juniors'
    when class_age between 12 and 15 then 'Teens'
    else 'Fora da faixa'
  end
  from age_calc
$$;

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

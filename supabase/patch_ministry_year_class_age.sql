-- DNMS Check-in: turma por idade ministerial anual.
-- A crianca permanece na turma vigente durante o ano em que faz aniversario
-- e so muda de turma no ano seguinte.

create or replace function public.get_student_class_for_birth_year(
  birth_date date,
  reference_date date default current_date
)
returns text
language sql
stable
as $$
  with age_calc as (
    select extract(year from reference_date)::int - extract(year from birth_date)::int - 1 as ministry_year_age
  )
  select case
    when birth_date is null or reference_date is null then 'Indefinida'
    when ministry_year_age between 2 and 3 then 'Maternal'
    when ministry_year_age between 4 and 6 then 'Kids'
    when ministry_year_age between 7 and 10 then 'Juniors'
    when ministry_year_age between 11 and 14 then 'Teens'
    else 'Fora da faixa'
  end
  from age_calc
$$;

update public.students
   set class_name = public.get_student_class_for_birth_year(birth_date, current_date)
 where class_name is distinct from public.get_student_class_for_birth_year(birth_date, current_date);

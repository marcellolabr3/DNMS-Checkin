-- DNMS Check-in: turma por idade ministerial anual.
-- A crianca entra no Maternal assim que completa 2 anos.
-- Depois disso, permanece na turma vigente durante o ano em que faz aniversario
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
    select
      extract(year from reference_date)::int - extract(year from birth_date)::int - 1 as ministry_year_age,
      date_part('year', age(reference_date, birth_date))::int as completed_age
  ),
  effective_age as (
    select case
      when ministry_year_age < 2 and completed_age >= 2 then 2
      else ministry_year_age
    end as class_age
    from age_calc
  )
  select case
    when birth_date is null or reference_date is null then 'Indefinida'
    when class_age between 2 and 3 then 'Maternal'
    when class_age between 4 and 6 then 'Kids'
    when class_age between 7 and 10 then 'Juniors'
    when class_age between 11 and 14 then 'Teens'
    else 'Fora da faixa'
  end
  from effective_age
$$;

update public.students
   set class_name = public.get_student_class_for_birth_year(birth_date, current_date)
 where class_name is distinct from public.get_student_class_for_birth_year(birth_date, current_date);

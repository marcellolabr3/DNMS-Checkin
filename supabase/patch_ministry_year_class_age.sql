-- DNMS Check-in: turma por idade cronologica na data de corte anual.
-- A data de corte e 31/03 do ano de referencia.

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
      make_date(extract(year from reference_date)::int, 3, 31) as cutoff_date
  ),
  effective_age as (
    select date_part('year', age(cutoff_date, birth_date))::int as class_age
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

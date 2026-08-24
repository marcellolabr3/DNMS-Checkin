insert into public.student_guardians (student_id, guardian_id)
select s.id, p.id
from public.students s
join public.profiles p
  on p.role = 'responsavel'
  and public.normalize_student_duplicate_text(p.name) =
    public.normalize_student_duplicate_text(s.primary_guardian_name)
where not exists (
  select 1
  from public.student_guardians sg
  where sg.student_id = s.id
    and sg.guardian_id = p.id
);

drop policy if exists students_delete_admin_or_own_guardian on public.students;
create policy students_delete_admin_or_own_guardian on public.students
for delete to authenticated
using (
  public.is_admin_user(auth.uid())
  or lower(coalesce((select p.email from public.profiles p where p.id = auth.uid()), '')) = 'marvinlabre@gmail.com'
  or exists (
    select 1 from public.student_guardians sg
    where sg.student_id = students.id and sg.guardian_id = auth.uid()
  )
);

drop policy if exists student_guardians_delete_staff_or_self on public.student_guardians;
create policy student_guardians_delete_staff_or_self on public.student_guardians
for delete to authenticated
using (
  guardian_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe', 'dnms_kids')
  )
  or lower(coalesce((select p.email from public.profiles p where p.id = auth.uid()), '')) = 'marvinlabre@gmail.com'
);

drop policy if exists checkins_delete_staff_or_guardian on public.checkins;
create policy checkins_delete_staff_or_guardian on public.checkins
for delete to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe', 'dnms_kids')
  )
  or lower(coalesce((select p.email from public.profiles p where p.id = auth.uid()), '')) = 'marvinlabre@gmail.com'
  or exists (
    select 1 from public.student_guardians sg
    where sg.student_id = checkins.student_id and sg.guardian_id = auth.uid()
  )
);

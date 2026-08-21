create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null default 'reprint' check (job_type in ('reprint')),
  checkin_id uuid not null references public.checkins (id) on delete cascade,
  requested_by uuid null references public.profiles (id) on delete set null default auth.uid(),
  status text not null default 'pending' check (status in ('pending', 'processing', 'printed', 'failed')),
  attempts integer not null default 0,
  claimed_by text null,
  claimed_at timestamptz null,
  printed_at timestamptz null,
  failed_at timestamptz null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_print_jobs_status_created_at on public.print_jobs (status, created_at);
create index if not exists idx_print_jobs_checkin on public.print_jobs (checkin_id);

create unique index if not exists print_jobs_one_open_reprint_per_checkin
on public.print_jobs (checkin_id)
where job_type = 'reprint' and status in ('pending', 'processing');

alter table public.print_jobs enable row level security;

drop policy if exists print_jobs_select_staff_or_requester on public.print_jobs;
create policy print_jobs_select_staff_or_requester on public.print_jobs
for select to authenticated
using (
  public.is_staff_user(auth.uid())
  or requested_by = auth.uid()
  or exists (
    select 1
    from public.checkins c
    join public.student_guardians sg on sg.student_id = c.student_id
    where c.id = print_jobs.checkin_id and sg.guardian_id = auth.uid()
  )
);

drop policy if exists print_jobs_insert_staff_or_guardian on public.print_jobs;
create policy print_jobs_insert_staff_or_guardian on public.print_jobs
for insert to authenticated
with check (
  job_type = 'reprint'
  and status = 'pending'
  and coalesce(attempts, 0) = 0
  and (
    public.is_staff_user(auth.uid())
    or exists (
      select 1
      from public.checkins c
      join public.student_guardians sg on sg.student_id = c.student_id
      where c.id = print_jobs.checkin_id and sg.guardian_id = auth.uid()
    )
  )
);

drop policy if exists print_jobs_update_staff on public.print_jobs;
create policy print_jobs_update_staff on public.print_jobs
for update to authenticated
using (public.is_staff_user(auth.uid()))
with check (public.is_staff_user(auth.uid()));

create or replace function public.claim_next_reprint_job(worker_id text default null)
returns table (
  id uuid,
  checkin_id uuid,
  attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with next_job as (
    select pj.id
    from public.print_jobs pj
    where pj.job_type = 'reprint'
      and (
        pj.status = 'pending'
        or (pj.status = 'processing' and pj.claimed_at < now() - interval '2 minutes')
      )
      and pj.attempts < 5
    order by pj.created_at asc
    for update skip locked
    limit 1
  )
  update public.print_jobs pj
  set
    status = 'processing',
    attempts = pj.attempts + 1,
    claimed_by = nullif(btrim(worker_id), ''),
    claimed_at = now(),
    updated_at = now(),
    error_message = null
  from next_job
  where pj.id = next_job.id
  returning pj.id, pj.checkin_id, pj.attempts;
end;
$$;

revoke all on function public.claim_next_reprint_job(text) from public;
grant execute on function public.claim_next_reprint_job(text) to service_role;

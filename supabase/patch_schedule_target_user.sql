alter table public.schedules
  add column if not exists target_user text null;

create index if not exists idx_schedules_target_user on public.schedules (target_user);

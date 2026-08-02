create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid null references public.profiles (id) on delete set null,
  actor_name text not null default '',
  actor_role text not null default '',
  action_type text not null,
  target_type text not null,
  target_id uuid null,
  target_name text not null default '',
  details text not null default '',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_action_type on public.audit_logs (action_type);
create index if not exists idx_audit_logs_target on public.audit_logs (target_type, target_id);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select_staff on public.audit_logs;
create policy audit_logs_select_staff on public.audit_logs
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'equipe', 'dnms_kids')
  )
  or lower(coalesce((select p.email from public.profiles p where p.id = auth.uid()), '')) = 'marvinlabre@gmail.com'
);

drop policy if exists audit_logs_insert_authenticated on public.audit_logs;
create policy audit_logs_insert_authenticated on public.audit_logs
for insert to authenticated
with check (auth.uid() = actor_id);

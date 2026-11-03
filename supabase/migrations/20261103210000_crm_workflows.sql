-- Automations (workflows + runs). Built-in workflows are seeded by the migration applied via MCP (see git history / docs/plan/crm/05).
create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  description text,
  trigger_type text not null,
  trigger_filter jsonb not null default '{}'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  active boolean not null default false,
  builtin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger workflows_touch before update on public.workflows for each row execute function private.touch_updated_at();
create index workflows_trigger_idx on public.workflows (trigger_type) where active;

create table public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  step_index int not null default 0,
  status text not null default 'waiting' check (status in ('waiting','running','done','stopped','failed','cancelled')),
  wake_at timestamptz not null default now(),
  context jsonb not null default '{}'::jsonb,
  log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger workflow_runs_touch before update on public.workflow_runs for each row execute function private.touch_updated_at();
create index workflow_runs_due_idx on public.workflow_runs (wake_at) where status = 'waiting';
create index workflow_runs_workflow_idx on public.workflow_runs (workflow_id, created_at desc);
create index workflow_runs_contact_idx on public.workflow_runs (contact_id);
create unique index workflow_runs_live_uidx on public.workflow_runs (workflow_id, contact_id) where status in ('waiting','running');

alter table public.workflows enable row level security;
alter table public.workflow_runs enable row level security;
create policy "workflows: staff all" on public.workflows for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "workflow_runs: staff all" on public.workflow_runs for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
grant select, insert, update, delete on public.workflows, public.workflow_runs to authenticated;

-- Pipeline: who moved each card and why, and a lock so the AI can't undo a person's move.
alter table public.contacts
  add column if not exists stage_locked_at timestamptz,
  add column if not exists stage_locked_by text;

-- Append-only history. Rejected AI proposals are kept too: they show where the AI and the rules disagree.
create table if not exists public.stage_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  actor_type text not null check (actor_type in ('system', 'ai', 'human')),
  actor text,
  decision text not null check (decision in ('applied', 'rejected')),
  reject_reason text,
  reason text,
  evidence_quote text,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists stage_events_contact_idx on public.stage_events (contact_id, created_at desc);

alter table public.stage_events enable row level security;
create policy "stage_events: staff read" on public.stage_events for select to authenticated using ((select private.is_staff()));
revoke insert, update, delete on public.stage_events from anon, authenticated;

-- "Form started" now means the driver opened the form. Sending the link no longer moves the card,
-- so anyone parked on the old "form sent" or "following up" meanings goes back to Interested.
update public.contacts set stage = 'interested' where stage in ('form_sent', 'chasing');

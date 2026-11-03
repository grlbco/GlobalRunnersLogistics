-- GRL Command — CRM core (docs/plan/crm/02-data-model.md).
-- Staff (recruiter/admin) only via private.is_staff(); webhooks/worker use the secret key (bypasses RLS).

create extension if not exists pg_trgm with schema extensions;

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

-- ---------- contacts (one profile per person) ----------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  usdot bigint unique,
  company_name text,
  street text,
  city text,
  state text check (state is null or char_length(state) = 2),
  timezone text,                                   -- IANA, from state
  first_name text,
  last_name text,
  email text unique check (email is null or email = lower(email)),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  cell_phone text check (cell_phone is null or cell_phone ~ '^\+[1-9][0-9]{7,14}$'),
  officer_2 text,
  tier smallint check (tier between 1 and 5),
  tier_label text,
  source text not null default 'toss_import',
  stage text not null default 'new' check (stage in (
    'new','contacted','replied','interested','form_sent','applied','qualified','sent_to_ken','hired',
    'nurture','not_fit','not_interested','unsubscribed','bounced')),
  stage_changed_at timestamptz not null default now(),
  tags text[] not null default '{}',
  owner_id uuid references public.profiles (id) on delete set null,
  agent_mode text not null default 'auto' check (agent_mode in ('auto','manual')),
  do_not_contact boolean not null default false,
  email_consent boolean not null default true,      -- cold email allowed until unsubscribe
  sms_consent boolean not null default false,       -- only after inbound text / explicit OK / form box
  driver_lead_id uuid references public.driver_leads (id) on delete set null,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  emails_sent int not null default 0,
  opens int not null default 0,
  clicks int not null default 0,
  search text generated always as (
    lower(coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(company_name,'') || ' ' ||
          coalesce(email,'') || ' ' || coalesce(usdot::text,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(city,''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_stage_idx on public.contacts (stage);
create index contacts_tier_idx on public.contacts (tier);
create index contacts_state_idx on public.contacts (state);
create index contacts_last_inbound_idx on public.contacts (last_inbound_at desc nulls last);
create index contacts_search_trgm on public.contacts using gin (search extensions.gin_trgm_ops);
create index contacts_owner_idx on public.contacts (owner_id);
create index contacts_driver_lead_idx on public.contacts (driver_lead_id);
create trigger contacts_touch before update on public.contacts for each row execute function private.touch_updated_at();

-- ---------- conversations + messages (every email, text, call in one timeline) ----------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  channel text not null check (channel in ('email','sms','call')),
  external_id text,                                 -- Instantly thread_id / Quo conversationId
  last_message_at timestamptz,
  unread boolean not null default false,
  created_at timestamptz not null default now(),
  unique (channel, external_id)
);
create index conversations_contact_idx on public.conversations (contact_id);
create index conversations_last_idx on public.conversations (last_message_at desc nulls last);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  channel text not null check (channel in ('email','sms','call')),
  direction text not null check (direction in ('inbound','outbound')),
  author text not null check (author in ('lead','campaign','agent','human','system')),
  author_id uuid references public.profiles (id) on delete set null,
  subject text,
  body text not null default '',
  external_id text,
  status text not null default 'sent' check (status in ('draft','queued','sent','delivered','failed','received')),
  error text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index messages_external_uidx on public.messages (channel, external_id) where external_id is not null;
create index messages_contact_idx on public.messages (contact_id, created_at desc);
create index messages_conversation_idx on public.messages (conversation_id);
create index messages_author_idx on public.messages (author_id);

-- ---------- notes, tasks, activities ----------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  author_kind text not null default 'human' check (author_kind in ('human','agent','system')),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index notes_contact_idx on public.notes (contact_id, created_at desc);
create index notes_author_idx on public.notes (author_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts (id) on delete cascade,
  assignee_id uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  due_at timestamptz,
  done_at timestamptz,
  created_by text not null default 'human' check (created_by in ('human','agent','workflow')),
  created_at timestamptz not null default now()
);
create index tasks_contact_idx on public.tasks (contact_id);
create index tasks_assignee_idx on public.tasks (assignee_id, done_at);

create table public.activities (
  id bigint generated always as identity primary key,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  type text not null,                               -- stage_changed, email_opened, link_clicked, form_step, tag_added …
  data jsonb not null default '{}'::jsonb,
  actor text not null default 'system',             -- system / agent / workflow / user:<uuid>
  created_at timestamptz not null default now()
);
create index activities_contact_idx on public.activities (contact_id, created_at desc);

-- ---------- raw events, suppressions, outbox ----------
create table public.events (
  id bigint generated always as identity primary key,
  source text not null check (source in ('instantly','quo','resend','website','system')),
  type text not null,
  contact_id uuid references public.contacts (id) on delete set null,
  external_id text,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index events_external_uidx on public.events (source, external_id) where external_id is not null;
create index events_contact_idx on public.events (contact_id);
create index events_unprocessed_idx on public.events (created_at) where processed_at is null;

create table public.suppressions (
  id bigint generated always as identity primary key,
  channel text not null check (channel in ('email','sms')),
  value text not null,                              -- lower email or E.164 phone
  reason text not null check (reason in ('stop','unsubscribe','bounce','complaint','manual','wrong_person')),
  created_at timestamptz not null default now(),
  unique (channel, value)
);

create table public.outbox (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  channel text not null check (channel in ('email','sms')),
  author text not null check (author in ('agent','human','workflow')),
  author_id uuid references public.profiles (id) on delete set null,
  subject text,
  body text not null,
  send_after timestamptz not null default now(),
  status text not null default 'pending' check (status in ('draft','pending','sending','sent','failed','cancelled')),
  attempts int not null default 0,
  dedupe_key text unique,
  error text,
  message_id uuid references public.messages (id) on delete set null,
  created_at timestamptz not null default now()
);
create index outbox_due_idx on public.outbox (send_after) where status = 'pending';
create index outbox_contact_idx on public.outbox (contact_id);
create index outbox_author_idx on public.outbox (author_id);
create index outbox_message_idx on public.outbox (message_id);

-- ---------- assistant ----------
create table public.agent_memory (
  contact_id uuid primary key references public.contacts (id) on delete cascade,
  facts jsonb not null default '{}'::jsonb,
  summary text,
  next_step text,
  mood text,
  updated_at timestamptz not null default now()
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  trigger text not null,
  input_message_id uuid references public.messages (id) on delete set null,
  decision jsonb not null default '{}'::jsonb,
  reply text,
  checks jsonb not null default '{}'::jsonb,
  action text,                                      -- replied / scheduled / handed_off / ignored / failed / draft
  model text,
  tokens_in int,
  tokens_out int,
  cost_usd numeric(10,5),
  latency_ms int,
  created_at timestamptz not null default now()
);
create index agent_runs_contact_idx on public.agent_runs (contact_id, created_at desc);
create index agent_runs_input_idx on public.agent_runs (input_message_id);

create table public.followups (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  due_at timestamptz not null,
  channel text check (channel in ('email','sms')),
  attempt int not null default 1,
  reason text,
  status text not null default 'pending' check (status in ('pending','done','cancelled')),
  created_at timestamptz not null default now()
);
create index followups_due_idx on public.followups (due_at) where status = 'pending';
create index followups_contact_idx on public.followups (contact_id);

-- ---------- personal form links ----------
create table public.form_links (
  token text primary key default encode(extensions.gen_random_bytes(12), 'hex'),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  sent_at timestamptz,
  opened_at timestamptz,
  step_reached smallint not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index form_links_contact_idx on public.form_links (contact_id);

-- ---------- settings (key/value) ----------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (key, value) values
  ('assistant', '{"enabled": false, "draft_mode": true, "max_per_day": 3, "delay_min_s": 120, "delay_max_s": 540, "quiet_start": "09:00", "quiet_end": "20:00", "no_sundays": true}'),
  ('sending', '{"enabled": false}');

-- ---------- RLS: staff only ----------
do $$
declare t text;
begin
  foreach t in array array['contacts','conversations','messages','notes','tasks','activities','events','suppressions',
                           'outbox','agent_memory','agent_runs','followups','form_links','app_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s: staff all" on public.%I for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Live updates in the CRM inbox / profile
alter publication supabase_realtime add table public.messages, public.contacts, public.agent_runs;

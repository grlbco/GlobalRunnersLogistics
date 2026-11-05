-- Forms module: Tally-style forms wired into the CRM. Public submissions go through a server action (admin client), never anon inserts.
create table public.crm_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  status text not null default 'draft' check (status in ('draft','published','closed')),
  schema jsonb not null default '{"pages":[],"settings":{}}',
  on_submit jsonb not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.crm_form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.crm_forms (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  data jsonb not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index crm_form_submissions_form_idx on public.crm_form_submissions (form_id, created_at desc);
create index crm_form_submissions_contact_idx on public.crm_form_submissions (contact_id);
create index crm_forms_created_by_idx on public.crm_forms (created_by);
alter table public.crm_forms enable row level security;
alter table public.crm_form_submissions enable row level security;
create policy "crm_forms: staff all" on public.crm_forms for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "crm_form_submissions: staff all" on public.crm_form_submissions for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
grant select, insert, update, delete on public.crm_forms, public.crm_form_submissions to authenticated;
alter publication supabase_realtime add table public.crm_form_submissions;

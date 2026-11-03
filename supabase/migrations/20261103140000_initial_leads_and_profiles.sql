-- Global Runners Logistics — initial schema: leads, consents, events, profiles/roles.
-- Public site inserts leads (anon). Applicants read their own rows. Staff (recruiter/admin) read all.

create schema if not exists private;

-- ---------- profiles & roles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'applicant' check (role in ('applicant', 'recruiter', 'admin')),
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 32),
  locale text not null default 'en' check (locale in ('en', 'es')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Staff check lives in a non-exposed schema; reads only the caller's own row.
create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('recruiter', 'admin')
  );
$$;
revoke all on function private.is_staff() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_staff() to authenticated;

-- Create a profile row for every new auth user.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, locale)
  values (
    new.id,
    left(new.raw_user_meta_data ->> 'full_name', 120),
    left(new.raw_user_meta_data ->> 'phone', 32),
    case when new.raw_user_meta_data ->> 'locale' = 'es' then 'es' else 'en' end
  );
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create policy "profiles: read own or staff" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or (select private.is_staff()));

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

grant select on public.profiles to authenticated;
-- Users may edit their name/phone/locale, never their role.
grant update (full_name, phone, locale) on public.profiles to authenticated;

-- ---------- driver quick-apply ----------
create table public.driver_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null check (char_length(last_name) between 1 and 60),
  phone text not null check (char_length(phone) between 7 and 32),
  email text check (email is null or (char_length(email) <= 254 and email like '%@%')),
  zip text check (zip is null or zip ~ '^[0-9]{5}$'),
  locale text not null default 'en' check (locale in ('en', 'es')),
  driver_type text not null check (driver_type in ('solo', 'team', 'either')),
  run_types text[] not null default '{}',
  has_team_partner boolean,
  has_cdl_a boolean not null,
  experience text not null check (experience in ('lt1', '1-2', '3-5', '5plus')),
  endorsements text[] not null default '{}',
  moving_violations text not null check (moving_violations in ('0', '1', '2', '3', '4plus')),
  accidents text not null check (accidents in ('0', '1', '2plus')),
  dui boolean not null,
  drug_test_issue boolean not null,
  work_authorized boolean not null,
  over_21 boolean not null,
  sms_consent boolean not null default false,
  flags text[] not null default '{}',
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'not_qualified', 'hired', 'archived')),
  utm jsonb not null default '{}'::jsonb,
  referrer text check (char_length(referrer) <= 500),
  landing_page text check (char_length(landing_page) <= 500)
);
create index driver_leads_created_at_idx on public.driver_leads (created_at desc);
create index driver_leads_user_id_idx on public.driver_leads (user_id);
create index driver_leads_email_idx on public.driver_leads (lower(email));
alter table public.driver_leads enable row level security;

create policy "driver_leads: public insert" on public.driver_leads
  for insert to anon, authenticated
  with check (status = 'new' and (user_id is null or user_id = (select auth.uid())));

create policy "driver_leads: read own or staff" on public.driver_leads
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or lower(email) = lower((select auth.jwt() ->> 'email'))
    or (select private.is_staff())
  );

create policy "driver_leads: staff update" on public.driver_leads
  for update to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

grant insert on public.driver_leads to anon, authenticated;
grant select, update on public.driver_leads to authenticated;

-- ---------- owner-operator leads ----------
create table public.owner_operator_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null check (char_length(last_name) between 1 and 60),
  phone text not null check (char_length(phone) between 7 and 32),
  email text check (email is null or (char_length(email) <= 254 and email like '%@%')),
  locale text not null default 'en' check (locale in ('en', 'es')),
  truck_year int check (truck_year between 1990 and 2030),
  truck_make text check (char_length(truck_make) <= 60),
  truck_model text check (char_length(truck_model) <= 60),
  trailer text check (trailer in ('none', 'own_dry_van', 'other')),
  own_authority boolean,
  years_owner_operator text check (years_owner_operator in ('lt1', '1-2', '3-5', '5plus')),
  home_base text check (char_length(home_base) <= 120),
  notes text check (char_length(notes) <= 2000),
  sms_consent boolean not null default false,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'not_qualified', 'leased', 'archived')),
  utm jsonb not null default '{}'::jsonb,
  referrer text check (char_length(referrer) <= 500),
  landing_page text check (char_length(landing_page) <= 500)
);
create index owner_operator_leads_created_at_idx on public.owner_operator_leads (created_at desc);
alter table public.owner_operator_leads enable row level security;

create policy "oo_leads: public insert" on public.owner_operator_leads
  for insert to anon, authenticated with check (status = 'new');
create policy "oo_leads: staff read" on public.owner_operator_leads
  for select to authenticated using ((select private.is_staff()));
create policy "oo_leads: staff update" on public.owner_operator_leads
  for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

grant insert on public.owner_operator_leads to anon, authenticated;
grant select, update on public.owner_operator_leads to authenticated;

-- ---------- contact messages ----------
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  email text check (email is null or (char_length(email) <= 254 and email like '%@%')),
  phone text check (phone is null or char_length(phone) between 7 and 32),
  topic text not null check (topic in ('driving', 'owner_operator', 'shipper', 'other')),
  message text not null check (char_length(message) between 1 and 4000),
  locale text not null default 'en' check (locale in ('en', 'es')),
  sms_consent boolean not null default false,
  status text not null default 'new' check (status in ('new', 'handled', 'archived'))
);
create index contact_messages_created_at_idx on public.contact_messages (created_at desc);
alter table public.contact_messages enable row level security;

create policy "contact: public insert" on public.contact_messages
  for insert to anon, authenticated with check (status = 'new');
create policy "contact: staff read" on public.contact_messages
  for select to authenticated using ((select private.is_staff()));
create policy "contact: staff update" on public.contact_messages
  for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

grant insert on public.contact_messages to anon, authenticated;
grant select, update on public.contact_messages to authenticated;

-- ---------- consent records (TCPA / SMS) ----------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null check (source in ('driver_lead', 'owner_operator_lead', 'contact', 'register')),
  phone text check (char_length(phone) <= 32),
  email text check (char_length(email) <= 254),
  consent_text text not null check (char_length(consent_text) <= 2000),
  granted boolean not null,
  ip text check (char_length(ip) <= 64),
  user_agent text check (char_length(user_agent) <= 500),
  page text check (char_length(page) <= 500)
);
create index consents_phone_idx on public.consents (phone);
alter table public.consents enable row level security;

create policy "consents: public insert" on public.consents
  for insert to anon, authenticated with check (true);
create policy "consents: staff read" on public.consents
  for select to authenticated using ((select private.is_staff()));

grant insert on public.consents to anon, authenticated;
grant select on public.consents to authenticated;

-- ---------- lead timeline (CRM foundation) ----------
create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_type text not null check (lead_type in ('driver', 'owner_operator', 'contact')),
  lead_id uuid not null,
  event text not null check (char_length(event) <= 60),
  detail jsonb not null default '{}'::jsonb,
  actor uuid references auth.users (id) on delete set null
);
create index lead_events_lead_idx on public.lead_events (lead_type, lead_id, created_at desc);
create index lead_events_actor_idx on public.lead_events (actor);
alter table public.lead_events enable row level security;

create policy "lead_events: staff all" on public.lead_events
  for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

grant select, insert on public.lead_events to authenticated;

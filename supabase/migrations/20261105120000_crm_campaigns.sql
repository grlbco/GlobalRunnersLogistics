create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  instantly_id uuid unique,
  name text not null check (char_length(name) between 1 and 150),
  status text not null default 'draft' check (status in ('draft','paused','active','completed','error')),
  sequence jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  stats_synced_at timestamptz,
  leads_added int not null default 0,
  error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger campaigns_touch before update on public.campaigns for each row execute function private.touch_updated_at();
create index campaigns_created_by_idx on public.campaigns (created_by);
create table public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (campaign_id, contact_id)
);
create index campaign_members_contact_idx on public.campaign_members (contact_id);
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
create policy "campaigns: staff all" on public.campaigns for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "campaign_members: staff all" on public.campaign_members for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
grant select, insert, update, delete on public.campaigns, public.campaign_members to authenticated;

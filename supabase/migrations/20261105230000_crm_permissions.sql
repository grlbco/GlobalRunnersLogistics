-- Staff access: roles with permission sets, per-person extra/removed permissions, suspend, forced password change.
-- A person is staff when profiles.crm_role is set and staff_status = 'active'.
-- Permission keys live in lib/crm/permissions.ts; '*' means every permission.

-- 1) Roles
create table public.crm_roles (
  key         text primary key check (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  name        text not null check (char_length(name) between 1 and 60),
  description text check (char_length(description) <= 300),
  permissions text[] not null default '{}',
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger crm_roles_touch before update on public.crm_roles
  for each row execute function private.touch_updated_at();
alter table public.crm_roles enable row level security;
revoke insert, update, delete on public.crm_roles from anon, authenticated;

insert into public.crm_roles (key, name, description, permissions, is_system) values
('admin', 'Admin', 'Everything, including the team and permissions.', array['*'], true),
('recruiter', 'Recruiter', 'Works drivers day to day: inbox, contacts, pipeline and forms. Sees campaigns, automations, reports and settings without changing them.',
  array['dashboard.view','inbox.view','contacts.view','contacts.edit','contacts.message','pipeline.view',
        'forms.view','forms.manage','campaigns.view','automations.view','reports.view','assistant.view','settings.view'], true),
('viewer', 'Viewer', 'Can look at everything, change nothing.',
  array['dashboard.view','inbox.view','contacts.view','pipeline.view','forms.view','campaigns.view',
        'automations.view','reports.view','assistant.view','settings.view'], true);

-- 2) Access columns on profiles
alter table public.profiles
  add column crm_role             text references public.crm_roles (key) on update cascade,
  add column permissions_grant    text[] not null default '{}',
  add column permissions_deny     text[] not null default '{}',
  add column staff_status         text not null default 'active' check (staff_status in ('active', 'suspended')),
  add column must_change_password boolean not null default false,
  add column invited_by           uuid references auth.users (id) on delete set null;
create index profiles_crm_role_idx on public.profiles (crm_role) where crm_role is not null;

-- existing staff keep their access
update public.profiles set crm_role = case role when 'admin' then 'admin' when 'recruiter' then 'recruiter' end
where role in ('admin', 'recruiter');

-- keep the legacy profiles.role in step (driver portal and older code read it)
create or replace function private.sync_legacy_role() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.role := case
    when new.crm_role is null or new.staff_status <> 'active' then 'applicant'
    when new.crm_role = 'admin' then 'admin'
    else 'recruiter' end;
  return new;
end $$;
create trigger profiles_sync_role before insert or update of crm_role, staff_status on public.profiles
  for each row execute function private.sync_legacy_role();

-- 3) Checks used by RLS and the app
create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.crm_role is not null and p.staff_status = 'active'
  );
$$;

create or replace function private.has_perm(p_perm text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    join public.crm_roles r on r.key = p.crm_role
    where p.id = (select auth.uid()) and p.staff_status = 'active'
      and not (p_perm = any (p.permissions_deny))
      and ('*' = any (r.permissions) or p_perm = any (r.permissions) or p_perm = any (p.permissions_grant))
  );
$$;
revoke execute on function private.has_perm(text) from public, anon;
grant execute on function private.has_perm(text) to authenticated;

-- staff can read roles (the app shows role names); only the server (secret key) writes them
create policy "crm_roles: staff read" on public.crm_roles for select to authenticated
  using ((select private.is_staff()));

-- 4) Who changed what on the team (written by the server only)
create table public.staff_audit (
  id         bigint generated always as identity primary key,
  actor_id   uuid references auth.users (id) on delete set null,
  target_id  uuid references auth.users (id) on delete set null,
  action     text not null check (char_length(action) <= 60),
  data       jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index staff_audit_created_idx on public.staff_audit (created_at desc);
create index staff_audit_actor_idx on public.staff_audit (actor_id);
create index staff_audit_target_idx on public.staff_audit (target_id);
alter table public.staff_audit enable row level security;
revoke insert, update, delete on public.staff_audit from anon, authenticated;
create policy "staff_audit: team managers read" on public.staff_audit for select to authenticated
  using ((select private.has_perm('team.manage')));

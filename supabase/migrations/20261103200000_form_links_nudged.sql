alter table public.form_links add column if not exists nudged_at timestamptz;
create index if not exists form_links_abandoned_idx on public.form_links (opened_at) where completed_at is null and nudged_at is null;

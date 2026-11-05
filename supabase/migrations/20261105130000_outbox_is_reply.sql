alter table public.outbox add column if not exists is_reply boolean not null default false;

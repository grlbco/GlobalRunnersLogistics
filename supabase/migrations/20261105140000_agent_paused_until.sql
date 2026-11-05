-- Human takeover pause (GoHighLevel-style "sleep after manual reply").
alter table public.contacts add column if not exists agent_paused_until timestamptz;
update public.app_settings set value = value || '{"max_followups": 4}'::jsonb where key = 'assistant';

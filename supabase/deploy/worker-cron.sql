-- Run ONCE after the site is live on Vercel (not a migration: it needs the real secret).
-- Replace <WORKER_SECRET> with the same value as WORKER_SECRET in Vercel.
-- Every minute: Supabase calls /api/worker/tick (sync texts/emails/calls, assistant, follow-ups, outbox, digest).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<WORKER_SECRET>', 'grl_worker_secret', 'Header for /api/worker/tick');

select cron.schedule(
  'grl-worker-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://globalrunnerslogistics.com/api/worker/tick',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'grl_worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- Check it runs:   select * from cron.job_run_details order by start_time desc limit 5;
-- Stop it:         select cron.unschedule('grl-worker-tick');

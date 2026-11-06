# Going live: GRL Command + website

Everything runs locally today. This is the exact order to put it on globalrunnerslogistics.com.

## 1. Vercel project
1. Reconnect Vercel to `grlbco/GlobalRunnersLogistics` (main branch), framework Next.js.
2. Domains: add `globalrunnerslogistics.com` (primary) and `www.globalrunnerslogistics.com` (redirect to apex).
3. Environment variables (Production): copy every key from `.env.local`, with these changes:
   - `NEXT_PUBLIC_SITE_URL=https://globalrunnerslogistics.com`
   - `NEXT_PUBLIC_ALLOW_INDEXING=true`
   - `WORKER_SECRET=` a new long random value (also used in step 3)
   - `SENDING_ENABLED=true` only when ready to send for real
   - Leave `QUO_WEBHOOK_SECRET`, `INSTANTLY_WEBHOOK_SECRET` empty for now (step 4 prints them)
4. Deploy. Check `https://globalrunnerslogistics.com/crm/settings` → Connections are green.

## 2. Supabase
- Auth → URL configuration: Site URL `https://globalrunnerslogistics.com`, redirect `https://globalrunnerslogistics.com/**`
  (covers the staff reset link `/crm/auth/callback` and the driver portal `/auth/callback`).
- Auth → Passwords: turn on **leaked password protection**, minimum length 10.
- Staff sign in at `/crm/login`. There is no sign-up: people are added on **CRM → Team** (temporary password, changed at first sign-in).

## Staff access (CRM → Team)
- Roles: **Admin** (everything, fixed), **Recruiter**, **Viewer**, plus any custom role an Admin creates. Each role is a set of permissions (`lib/crm/permissions.ts`).
- Per person: tick or untick single permissions on top of their role (stored as extras/removals).
- Rules: you can only give access you have; you can't change your own access; at least one person must keep "manage the team".
- Suspend blocks sign-in at once; Remove takes CRM access away but keeps the login (they may also be a driver).
- Every sign-in and team change is logged (Team → Activity, table `staff_audit`).

## 2b. Database changes come before the code
Apply everything in `supabase/migrations/` that isn't on the live database yet, then deploy. The app reads the new columns on every stage move.

## 3. Background worker (every minute)
Open the Supabase SQL editor, paste `supabase/deploy/worker-cron.sql`, replace `<WORKER_SECRET>`, run.
Check: `select * from cron.job_run_details order by start_time desc limit 5;` shows `succeeded`.

## 4. Webhooks (instant replies, calls)
```
node scripts/register-webhooks.mjs https://globalrunnerslogistics.com
```
Put the printed `QUO_WEBHOOK_SECRET` / `INSTANTLY_WEBHOOK_SECRET` into Vercel and redeploy.
(The 1-minute worker also pulls everything, webhooks just make it instant.)

## 5. Telegram (Ken's alerts)
Steps are in `.env.example`. Add `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` to Vercel, redeploy,
then CRM → Settings shows Telegram green.

## 6. Optional: replies to direct emails into the CRM
Resend → enable receiving on `reply.globalrunnerslogistics.com` (add its MX record), webhook `email.received`
→ `https://globalrunnerslogistics.com/api/hooks/resend`, then set `RESEND_INBOUND_ADDRESS=ken@reply.globalrunnerslogistics.com`
and `RESEND_WEBHOOK_SECRET`.

## 7. Launch
Follow the Go-live checklist on the CRM dashboard. Start with a 10-lead pilot campaign in draft mode,
then tier waves. Kill switch: CRM → Settings → All sending.

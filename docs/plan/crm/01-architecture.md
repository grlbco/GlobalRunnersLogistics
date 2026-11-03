# 01 · Architecture

## Components
```
                ┌──────────────── Next.js app (Vercel) ─────────────────┐
 Website ──────►│  /apply/driver  /f/[token]  (forms)                     │
                │  /crm/*        (staff UI, Supabase Auth, role=staff)    │
 Instantly ────►│  /api/hooks/instantly   (webhook, secret header)        │
 Quo ──────────►│  /api/hooks/quo         (HMAC openphone-signature)      │
                │  /api/worker/tick       (called every minute)           │
                └───────────────┬──────────────────────────┬─────────────┘
                                │                          │
                       Supabase Postgres              External APIs
              contacts · conversations · messages     Instantly v2 · Quo · Resend
              events · jobs (pgmq) · agent_memory     DeepSeek (OpenAI-compatible)
              workflows · campaigns · stats
              pg_cron ─► pg_net ─► /api/worker/tick
              Realtime ─► CRM inbox updates live
```

## Principles
1. **Webhooks only record, never think.** A webhook verifies the signature, writes an `events` row + the message, enqueues a job, returns 200 in <1s. All slow work (agent, sending, syncing) happens in the worker. Retries never double-send because every external id is unique.
2. **One queue, one worker.** `pgmq` queue `jobs`. `pg_cron` calls `/api/worker/tick` every minute (works on Vercel Hobby). The tick drains jobs for ~50s. Job types: `agent.think`, `send.email`, `send.sms`, `sync.instantly`, `workflow.step`, `followup.due`.
3. **Every outbound message goes through the outbox.** Agent, workflows and humans all write to `outbox` with `send_after`. One sender enforces quiet hours, consent, opt-outs, rate limits and a final dedupe. Nothing calls Instantly/Quo send APIs directly.
4. **The CRM is the source of truth.** Instantly and Quo are mirrored in (messages, statuses, stats). Pipeline changes in the CRM push back (Instantly interest status, Quo contact).
5. **Humans can always take over.** "Take over" pauses the agent on that lead; a human reply in Quo/Instantly also pauses it automatically.

## Why this stack (vs. alternatives)
| Choice | Why | Rejected |
|---|---|---|
| Keep Instantly for cold email | Warmup pool + inbox rotation = deliverability we can't rebuild | Self-hosted sender (blacklists, warmup from zero) |
| pgmq + pg_cron in Supabase | Durable, retryable, no extra service, all data in one DB | Inngest/Trigger.dev (another vendor), Vercel Cron (Hobby = daily only) |
| DeepSeek V4 Flash | Cheap enough to think on every message, tool calling, 1M context | Quo Sona (no control over memory/voice, SMS only) |
| CRM inside the website repo | Same design system and auth for free; one deploy | Separate app (duplicate tokens, two logins) |

## Scale math (20k leads)
- ~20k cold emails over 3–4 weeks in waves (tier order). Typical 1–3% reply → **200–600 conversations**.
- Agent cost: ~3k tokens per decision with cached prefix; even 10 turns × 600 leads ≈ 18M tokens ≈ **a few dollars**.
- Quo API texts: about $0.01 per segment, prepaid.

# 08 · Research notes (Nov 2026)

## API facts used in this plan
- **Instantly v2** webhooks: `reply_received`, `auto_reply_received`, `lead_interested`, `lead_not_interested`, `lead_neutral`, `email_bounced`, `lead_unsubscribed`, meeting/closed/out-of-office/wrong-person, custom labels; payload carries `email_id` usable as `reply_to_uuid`, plus `reply_text`. Reply endpoint `POST /api/v2/emails/reply` (needs `eaccount`, `reply_to_uuid`, subject, body). Campaigns take `sequences[].steps[].variants[]` (A/B). Interest sync `POST /api/v2/leads/update-interest-status`. v1 API deprecated Jan 2026. — developer.instantly.ai
- **Quo** API webhooks: `message.received`, `message.delivered`, `call.ringing`, `call.completed`, `call.recording.completed`, transcripts; HMAC header `openphone-signature`. App-created and API-created webhooks are separate. Messages ≤1,600 chars, prepaid API credits. A2P: one registration per workspace, $19.50 + $1.50/mo, review takes days. Sona agent exists (SMS, beta) — not used. — quo.com/docs, support.openphone.com
- **DeepSeek**: OpenAI-compatible, `deepseek-v4-flash` / `deepseek-v4-pro`, 1M context, tool calling + JSON; legacy `deepseek-chat`/`deepseek-reasoner` aliases deprecated 2026-07-24; automatic prefix caching. Tool-arg hallucination is a known weakness → validate every tool call with zod and retry once. — api-docs.deepseek.com (via morphllm, openrouter summaries)
- **Supabase** background jobs: `pg_cron` + `pg_net` + `pgmq` queue pattern; `pgflow` is a Supabase-native workflow engine worth evaluating for workflow runs.
- **TCPA**: one-to-one consent rule vacated; revocation-of-consent rules (any reasonable method, 10 business days max, one confirmation text within 5 min) with parts delayed again (2027). Quiet-hours lawsuits rising.

## Open-source references (read for patterns, don't fork)
| Project | Use it for | License note |
|---|---|---|
| **Atomic CRM** (marmelab) — React + shadcn + Supabase | Contacts/deals/notes data model, Supabase RLS patterns | MIT |
| **Twenty** | Pipeline/table UX, timeline design | AGPL — reference only |
| **Chatwoot** | Unified inbox UX (assign, snooze, drafts) | MIT core |
| **pgflow** | Durable multi-step workflows on Supabase | Apache-2.0 |
| **seldonframe**, **open-agency-os** | GHL-alternative scope checklists (2026, active) | check before reuse |
| Our **BRAIN** prototype | Webhooks, outbox, reply checks, form tokens, reminders | ours |

Verdict: no open-source project gives Instantly + Quo + agent + CRM together; building on our own Next.js/Supabase base with these as references is faster than adapting any of them.

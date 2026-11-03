# 03 · Integrations

## Instantly (API v2, Bearer key)
**In (webhook `all_events` → `/api/hooks/instantly`, secret in custom header):**
| Event | CRM effect |
|---|---|
| `email_sent` / `email_opened` / `link_clicked` | message row (campaign author) / activity; stats |
| `reply_received` | inbound message (full `reply_text`), stage ≥ `replied`, enqueue `agent.think` |
| `auto_reply_received`, `lead_out_of_office` | log only; follow-up after return date |
| `lead_interested` / `lead_not_interested` / `lead_neutral` | stage move (forward-only for automation) |
| `email_bounced`, `lead_unsubscribed` | suppression + stage, cancel follow-ups |
| `lead_wrong_person` | stage `not_fit`, no agent |

**Out:**
- `POST /api/v2/campaigns` — create campaign with sequence steps and **variants** (A/B/C on subject + body), paused for review; `/activate`, `/pause`.
- `POST /api/v2/leads` (or bulk add) with `skip_if_in_workspace`, custom variables from contact (firstName, companyName, city, tier).
- `POST /api/v2/emails/reply` with `eaccount` + `reply_to_uuid` — the agent's email replies stay in the same thread from the same inbox.
- `POST /api/v2/leads/update-interest-status` — keep Instantly labels in sync with our stage.
- `GET /api/v2/campaigns/analytics` + steps analytics every 3h → `campaign_stats_daily` (per variant → A/B winner).
- Instantly MCP (already connected) is how *I* (Claude) build and tune campaigns with you; the app uses the REST API.

## Quo (API key + webhooks)
**In (`/api/hooks/quo`, verify `openphone-signature` HMAC):** `message.received` (→ inbound message, consent check, `agent.think`), `message.delivered`/failed (status), `call.completed` + `call.recording.completed` + transcript (→ `calls`, summary into memory), contact updates.
**Out:** send message (`from` = GRL Quo number `+17256661558`, `to` E.164, ≤1,600 chars, we keep ≤320), create/update contact (with CRM link), contact notes (agent summary for Ken in Quo), fetch history for backfill.
- **A2P 10DLC must be approved** before any automated text. One registration per workspace: $19.50 once + $1.50/mo.
- Quo's own agent (Sona) stays **off** so two agents never answer the same person.

## Website forms
- Personal link `/f/[token]` (or `/apply/driver?t=token`) pre-fills name/phone/email; each step saves (`form_links.step_reached`); submit → `driver_leads` + stage `applied` + cancel follow-ups + alert Ken (text/email) + agent sends a short thank-you.
- Consent checkbox wording stored in `consents` — that's what unlocks texting for leads who never texted us.

## Resend
System email only: Ken alerts, daily digest, password resets. Never cold email (that's Instantly).

## DeepSeek
OpenAI-compatible `https://api.deepseek.com`, model `deepseek-flash` (confirmed from our account's model list; `deepseek-v4-pro` also available). Tool calling + JSON output. Keep the system prompt + facts as a stable prefix so context caching cuts cost. Wrapper behind an interface so the model can be swapped (Claude/OpenAI) without touching the agent.

## Secrets (Vercel env, never git)
`INSTANTLY_API_KEY`, `INSTANTLY_WEBHOOK_SECRET`, `QUO_API_KEY`, `QUO_WEBHOOK_SECRET`, `DEEPSEEK_API_KEY`, `RESEND_API_KEY`, `WORKER_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.

# GRL Command — recruiting CRM + agent (plan)

**One system** that takes a cold lead from the 20k list to a completed driver application without anyone chasing them:

```
20k leads ─► Instantly campaign (A/B) ─► reply ─► CRM profile + pipeline
                                            │
                       Agent (DeepSeek, per-lead memory) talks by email + text
                                            │
                      driver form completed ─► "Applied" ─► Ken calls ─► Hired
```

- **Where:** inside this repo at `/crm` (staff only), same Next.js app, same design tokens, same Supabase project (`ercilamdgoyypghzrwic`). One deploy, one login, one database.
- **Engines we keep:** Instantly sends cold email (warmup, rotation, deliverability — we don't rebuild that), Quo sends/receives texts and calls, Resend sends system email. **Our CRM is the brain and the record**; the tools are pipes.
- **Starting point:** the earlier prototype `E:\DEV\GLOBAL RUNNERS\BRAIN` (CarrieX Funnels) already has the webhooks, outbox, reply checks, form tokens and reminders. We port and upgrade it here instead of starting over.

## Docs
| # | Doc | What it decides |
|---|---|---|
| 01 | [Architecture](01-architecture.md) | Components, data flow, where each job runs |
| 02 | [Data model](02-data-model.md) | Supabase tables, RLS, realtime |
| 03 | [Integrations](03-integrations.md) | Instantly, Quo, Resend, website forms — every webhook and API call |
| 04 | [Agent](04-agent.md) | DeepSeek agent: memory, tools, voice, guardrails, follow-up cadence |
| 05 | [Automations](05-automations.md) | Workflow engine (GoHighLevel-style triggers → actions) + built-in flows |
| 06 | [CRM screens](06-crm-ui.md) | Dashboard, Inbox, Pipeline, Lead profile, Campaigns, Automations, Agent, Settings |
| 07 | [Compliance](07-compliance.md) | TCPA / A2P 10DLC / CAN-SPAM rules baked into code |
| 08 | [Research](08-research.md) | Sources, API facts, open-source references |
| 09 | [Build phases](09-phases.md) | Order of work, tests, launch plan for the 20k |

## Decisions needed from George / Ken
1. **DeepSeek API key** (platform.deepseek.com) and a monthly cap.
2. **Instantly:** sending domains/inboxes warmed? (2–3 weeks warmup before volume). API key with `all:all` scope.
3. **Quo:** A2P 10DLC registration submitted? Needs EIN-matching business details. No automated texting until approved.
4. **Sender identity:** emails and texts "from Ken Aman, Global Runners Logistics"? Agent signs as Ken's team.
5. **Hand-off rule:** after the form is done, does the agent stop, or keep scheduling Ken's call?
6. **Pay facts:** solo CPM still unconfirmed — the agent can only quote confirmed facts.

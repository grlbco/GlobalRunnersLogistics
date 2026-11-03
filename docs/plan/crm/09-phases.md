# 09 · Build phases

| Phase | Deliverable | Done when |
|---|---|---|
| **0 · Setup** (you) | DeepSeek key, Instantly key + warmed inboxes, Quo A2P submitted, Vercel live | keys in Vercel, webhooks reachable |
| **1 · Foundation** | Migrations (02), staff roles, `/crm` shell in site design, import 20k CSV → contacts, port BRAIN integrations | 20k contacts searchable, profiles open |
| **2 · Pipes** | Instantly + Quo webhooks → messages/activities, outbox sender with all checks, backfill existing threads | test email reply + test text appear in the profile timeline live |
| **3 · Inbox + Profile + Pipeline** | Unified inbox, timeline, kanban, manual reply by email/text, notes/tasks | George can run everything by hand |
| **4 · Agent** | DeepSeek agent with memory, tools, guardrails, human timing, follow-up ladder, test suite | 40 scripted conversations pass; dry-run mode (drafts only) for 3 days |
| **5 · Forms loop** | Personal form links, step tracking, abandoned nudges, applied → Ken alerts | form completion moves stage + stops follow-ups |
| **6 · Automations** | Engine + builder + 9 built-in workflows | built-ins run from the builder, editable |
| **7 · Campaigns** | Campaign/variant editor synced to Instantly, stats + A/B winner, wave scheduler | tier 1 campaign created paused, approved, live |
| **8 · Launch** | 10-lead pilot → tier 1 (3,060) → tiers 2–5 over ~3 weeks | daily digest, reply-to-form rate tracked |

**Launch safety:** agent starts in *draft mode* (staff approves each message) for the first 50 conversations, then auto with review. Kill switch on the dashboard stops all sending instantly.

**Testing:** unit tests for checks/consent/quiet hours/opt-out; webhook fixtures from real payloads; Playwright for inbox/profile; scripted agent conversations in CI.

# 02 · Data model (Supabase)

All tables RLS-on. Staff read/write via `private.is_staff()`; service role for webhooks/worker. Website anon inserts stay as today.

## Core
| Table | Key columns | Notes |
|---|---|---|
| `contacts` | id, first/last name, email (unique, lower), phone/cell (E.164), usdot, company, city, state, **timezone** (from state), tier, source, owner_id, tags[] | One profile per person. Imported from the 20k CSV. |
| `pipeline_stages` | key, label, order, tone | `new → contacted → replied → interested → form_sent → applied → qualified → sent_to_ken → hired`, lost: `not_fit · not_interested · unsubscribed · bounced` |
| `deals` | contact_id, stage, stage_changed_at, value, lost_reason | One active deal per contact (room for multiple later) |
| `conversations` | contact_id, channel (`email`/`sms`/`call`), external thread id, last_message_at, unread | Email thread = Instantly thread_id; SMS = Quo conversationId |
| `messages` | conversation_id, contact_id, channel, direction, author (`lead`/`campaign`/`agent`/`human`/`system`), subject, body, external_id (unique), status, sent_at, meta | **Every** email, text, call summary in one timeline |
| `calls` | contact_id, quo_call_id, direction, duration, recording_url, transcript, summary | From Quo call webhooks |
| `notes`, `tasks` | contact_id, author, body / due_at, done | Human + agent can create |
| `activities` | contact_id, type, data, actor, created_at | Timeline of stage moves, opens, clicks, form steps, tags |

## Outreach
| Table | Notes |
|---|---|
| `campaigns` | Mirror of Instantly campaign (id, name, status, schedule, sequence JSON with variants) + our goal/tier |
| `campaign_stats_daily` | sent, opened, replied, bounced, interested per day per variant |
| `campaign_members` | contact_id, campaign_id, variant, step, status |
| `outbox` | contact_id, channel, author, subject, body, send_after, status, attempts, dedupe_key, error |

## Agent
| Table | Notes |
|---|---|
| `agent_memory` | contact_id (pk), **facts** jsonb (CDL years, location, equipment, objections, preferred channel, best time), **summary** (rolling, ≤150 words), mood, next_step, updated_at |
| `agent_runs` | contact_id, trigger, input msg id, decision JSON, tool calls, reply, checks, model, tokens, latency |
| `agent_settings` | on/off, max replies/lead/day, delays, quiet hours, voice examples, offer facts (only facts the agent may quote) |
| `followups` | contact_id, due_at, channel, attempt #, reason, status — the "keep going until the form is done" ladder |

## Automation
| Table | Notes |
|---|---|
| `workflows` | name, trigger (event type + filter), steps JSON (actions, waits, branches), active |
| `workflow_runs` | workflow_id, contact_id, current step, status, wake_at |
| `events` | source, type, contact_id, payload, created_at — raw log of every webhook and internal event |

## Compliance
`consents` (exists) gets `channel`, `source` (form / inbound text / verbal), `wording`, ip, at. `suppressions`: email/phone, reason (STOP, unsubscribe, bounce, complaint), at — checked by the outbox before every send.

## Forms
Website `driver_leads` stays the application record. New: `form_links` (token, contact_id, opened_at, step_reached, completed_at) so `/f/[token]` pre-fills and the CRM sees partial progress ("stopped at step 3").

## Realtime
Publish `messages`, `deals`, `agent_runs` to Supabase Realtime → Inbox and Lead profile update live.

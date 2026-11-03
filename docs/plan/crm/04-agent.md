# 04 · The agent ("Ken's team")

**Job:** every interested driver ends up with a completed driver form. Answer questions honestly, handle objections, keep following up by email and text until the form is done, then hand to Ken.

## Loop (one run per trigger)
Triggers: inbound email/text, form opened but not finished, follow-up due, call transcript arrived.
```
load context ─► decide (DeepSeek, tools) ─► checks ─► outbox (delayed, human-timed) ─► update memory + stage
```
**Context sent each run** (stable prefix first for caching):
1. System: role, voice rules, offer facts (only confirmed facts from `content/facts.ts` + settings), compliance rules.
2. Lead card: name, city/state, local time, tier, stage, consent per channel, form status (sent/opened/step/done).
3. **Memory:** `facts` JSON + rolling `summary` + `next_step`.
4. Last ~12 messages across email + text (full thread available via tool).

**Tools:** `send_email_reply`, `send_text`, `schedule_followup(at, channel, reason)`, `move_stage`, `save_fact(key, value)`, `get_form_link`, `create_task_for_ken`, `handoff_to_human(reason)`, `mark_do_not_contact`, `get_full_thread`.

## Memory (per lead)
- **Facts** (structured, upserted by `save_fact`): CDL-A years, endorsements, current company, why looking, home location, solo/team, objections raised, preferred channel, best time, family/home-time needs.
- **Summary** rewritten after every run (≤150 words) — "Art, 6 yrs OTR, wants home weekly, worried about pay, prefers text after 6pm, opened form, stopped at step 3."
- Never repeat a question already answered; reference earlier details naturally ("still thinking about the Georgia runs?").

## Voice — reads like a real recruiter
- Texts: 1–2 sentences, ≤240 chars, lowercase-ok casual, no links except the form link, no emojis by default, never "As an AI".
- Emails: 2–4 short lines, plain text, no signature blocks beyond "Ken / Global Runners".
- One question at a time. Mirror the driver's language (Spanish → Spanish).
- **Human timing:** reply delay 2–9 min (random), longer at night → next morning; never instant, never two messages back-to-back.
- Few-shot examples of good/bad replies kept in `agent_settings.voice_examples` (editable).

## Follow-up ladder (until form done or stop signal)
| When (after last touch) | Channel | Example intent |
|---|---|---|
| +20 h | same channel as their reply | nudge + form link |
| +2 days | text if consent, else email | answer likely objection |
| +4 days | email | short social proof / weekly pay |
| +7 days | text/email | "still looking?" |
| +14 days | email | last check, then park as `nurture` |
Any reply resets the ladder. Form opened but not finished → nudge in 2 h ("saw you started, takes 1 more min").

## Guardrails (in code, not just prompt)
- Opt-out words / "stop" / anger → no reply, suppress, confirm once (texts) within 5 min.
- Numbers in a reply must exist in the offer facts; banned phrases list; max length; only allowed link = form link.
- Max 3 agent messages/lead/day, max 1 unanswered text in a row before waiting for the ladder.
- Low confidence, legal/immigration/medical/accident questions, pay negotiation beyond facts → `handoff_to_human` + alert.
- Human replied in Quo/Instantly → agent pauses on that lead.
- Every run logged in `agent_runs` with reasoning, visible on the lead profile.

## Quality
- Test suite of ~40 scripted conversations (interested, skeptical, Spanish, wrong person, owner-operator, angry, STOP) run before each prompt change.
- Weekly review screen: replies rated 👍/👎 by staff → become voice examples.

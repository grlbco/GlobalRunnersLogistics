# 05 · Automations (GoHighLevel-style)

## Engine
Workflow = **trigger → filters → steps**. Steps: `send_email`, `send_text`, `wait (duration | until time | until event)`, `if/else` (on field, tag, stage, consent, form status), `move_stage`, `add_tag`, `assign`, `create_task`, `notify (Ken/team: text, email)`, `hand_to_agent`, `stop_agent`, `webhook`.
Runs stored in `workflow_runs`; waits become `wake_at` and the worker tick resumes them. A visual builder (vertical step list with branches, like GHL) in `/crm/automations`.

## Triggers
`contact.created`, `email.replied`, `text.received`, `stage.changed`, `form.opened`, `form.step`, `form.completed`, `email.opened` (n times), `link.clicked`, `tag.added`, `call.missed`, `call.completed`, `date/time`, `inactive_for(n days)`.

## Built-in workflows (on by default)
1. **Reply → agent:** email/text reply → stage `replied` → agent thinks.
2. **Interested → form:** agent/Instantly marks interested → create form link → agent sends it → stage `form_sent`.
3. **Form abandoned:** opened, not done in 2h → agent nudge; 24h → second nudge.
4. **Form completed:** stage `applied` → stop follow-ups → text + email Ken with summary + call button → task "Call within 1h" for Ken.
5. **Ken no action in 2h:** remind Ken; 24h → agent texts driver "Ken's trying to reach you, what time works?"
6. **Missed call from a lead:** agent texts back within 2 min ("sorry missed you, call you back at…").
7. **Opt-out / bounce:** suppress everywhere, cancel runs.
8. **Hot open signal:** opened 3+ times, no reply → move to a short "plain text bump" Instantly subsequence.
9. **Daily digest 8:00 PT:** new replies, forms done, who needs a call.

## Campaigns (my part, with you)
- I draft sequences (3–4 steps) with **A/B/C variants** per step, create them paused in Instantly, you approve, then activate tier by tier.
- Variant stats → winner after ≥300 sends/variant with reply-rate difference that's meaningful; loser paused, new challenger added.
- Waves: tier 1 → 5, ~800–1,500/day depending on inbox count, so Ken isn't flooded.

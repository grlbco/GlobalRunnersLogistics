# 07 · Compliance (enforced in code)

Not legal advice — have a TCPA attorney review the texting flow before launch. Fines are $500–$1,500 **per text**.

## Texting (TCPA + carriers)
- **No cold texts.** The 20k list gets email only. A lead becomes textable only when: (a) they texted our Quo number first, (b) they gave their number and said OK to text in an email reply, or (c) they ticked the consent box on the form (wording + time + IP saved). Code: outbox refuses `sms` without a `consents` row for that phone.
- **A2P 10DLC approved** in Quo before any automated text (sample messages include "Reply STOP to opt out").
- **Opt-out:** STOP, QUIT, END, REVOKE, OPT OUT, CANCEL, UNSUBSCRIBE, and any clear "don't text me" → suppress immediately, one confirmation text within 5 minutes with no marketing, cancel all runs. Revocation rules have moved dates several times (current FCC delays push parts to 2027) — we follow the strictest version now.
- **Quiet hours:** only 9:00–20:00 in the lead's local time (stricter than federal 8–21 to cover state laws like FL/OK), no Sundays for automated follow-ups.
- First text identifies us: "Ken from Global Runners Logistics".

## Email (CAN-SPAM)
Instantly handles unsubscribe links; every email includes the office address (732 S 6th St Ste V, Las Vegas, NV 89101); honest subject lines; unsubscribes synced to `suppressions` within minutes.

## Data
Lead data from public FMCSA records; store only what's needed; staff-only RLS; audit log in `activities`; delete on request.

## Brand
Everything under Global Runners Logistics LLC. No Landstar, no Tenstreet. Agent never states unconfirmed pay, never promises hiring, never asks about immigration status.

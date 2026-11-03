# 07 — Login / Register & CRM Foundation

The website ships with working auth so the CRM (next build) plugs straight in.

## Scope for the website build
- Pages: `/login`, `/register`, `/reset-password`, `/auth/callback`, protected `/dashboard`.
- **Driver portal (GRL's own, no third-party application systems):** applicants log in to complete the full DOT application (`05-forms-data.md`), upload documents, e-sign disclosures, and see their application status. Recruiter/admin side is a placeholder until the CRM build.
- Supabase Auth with `@supabase/ssr` (cookie sessions, middleware refresh, server-side `getUser()` checks — never trust `getSession()` alone).
- Methods: email + password and magic link; Google sign-in optional.
- Emails (confirm, reset, magic link) sent through Resend SMTP with branded templates (EN/ES).
- Same design language as the site (dark, minimal), header switches to "Dashboard" when signed in.

## Roles (prepared, enforced by RLS)
| Role | Who | Access |
|---|---|---|
| `applicant` | Drivers / O/Os who register | Own profile + own applications |
| `recruiter` | Ken, staff | All leads, notes, statuses |
| `admin` | George | Everything + settings |
Stored in a `profiles` table with `role`; RLS policies check it via a security-definer helper.

## CRM hooks we lay now
- `lead_events` timeline table (already in `05-forms-data.md`).
- Webhook routes stubbed: `/api/webhooks/quo`, `/api/webhooks/resend`, `/api/webhooks/instantly`, `/api/webhooks/tally` (signature-verified, write into `lead_events`).
- UTM/source on every lead → later campaign ROI per channel (Instantly, Quo, Craigslist, Google Jobs).

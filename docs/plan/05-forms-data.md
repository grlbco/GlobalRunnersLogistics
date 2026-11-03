# 05 — Forms, Data & Lead Flow

## Forms

### Driver quick-apply `/apply/driver` (multi-step, ~2 minutes, mostly taps)
1. **You** — first name, last name, mobile, email, ZIP (auto-fills city/state), preferred language EN/ES.
2. **Job** — Team / Solo / Either · OTR / Regional / Dedicated (multi) · have a team partner? (if team).
3. **Experience** — CDL-A yes/no · years (chips: <1, 1–2, 3–5, 5+) · endorsements (Hazmat, Tanker, Doubles/Triples, TWIC, None) · automatic only? 
4. **Record** — moving violations last 3 yrs (0, 1, 2, 3, 4+) · DUI ever? · failed/refused drug test or SAP program? · accidents last 3 yrs.
5. **Consent** — TCPA SMS/call consent checkbox (unchecked by default, links to SMS Terms) · privacy acknowledgment · submit.

Smart rules: soft "may not qualify" note (never auto-reject on screen) if <1 yr, DUI, SAP, 4+ violations or under 21 — still saved, flagged in CRM. On success: thank-you screen with "Ken will call you from (312) 975-3377", plus "Create your account to finish your full application" → GRL driver portal.

### Full DOT driver application — inside GRL's own portal (no third-party systems)
After quick-apply, the driver creates an account (`/register`, pre-filled) and completes the full employment application required by FMCSA (49 CFR 391.21), saving progress between sessions:
1. Personal info + 3-year address history.
2. CDL: number, state, class, endorsements, expiration; any license denied/suspended/revoked.
3. Employment history: 3 years for all jobs, 10 years for CMV driving jobs, with gaps explained; DOT-regulated employer flags (for 391.23 safety-performance inquiries).
4. Accidents (3 yrs) and traffic convictions (3 yrs).
5. Drug & alcohol questions (49 CFR 40.25) + Clearinghouse consent.
6. Disclosures and e-signatures: FCRA background/MVR disclosure + authorization (stand-alone page), PSP disclosure, certification of truthfulness. Signed PDF generated and stored.
7. Document uploads: CDL front/back, medical card, (optional) work authorization — stored in a private Supabase Storage bucket.
Recruiter reviews everything in the CRM. Final hiring steps (MVR pull, drug test, road test) are tracked there.

### Owner-operator lead `/apply/owner-operator`
Contact info · truck year/make/model · trailer (none/own 53' van) · own authority? · years as O/O · home base · preferred freight/lanes · consent.

### Contact `/contact`
Name · email · phone · topic (Driving job / Owner-operator / Shipper / Other) · message · consent.

All forms: React Hook Form + Zod, Server Actions, honeypot + Cloudflare Turnstile (invisible), rate-limited by IP, UTM + referrer + landing page captured for campaign attribution (Instantly / Quo / Craigslist / Google).

## Supabase schema (first migration)
```
applicants            -- one row per person (dedupe on phone/email)
applications          -- driver quick-apply submissions → applicants
owner_operator_leads
contact_messages
lead_events           -- timeline: submitted, sms_sent, called, status_changed (CRM foundation)
consents              -- TCPA/SMS consent records: text shown, timestamp, IP, user agent
-- prepared for the portal application (built in step 8):
driver_applications_full, address_history, employment_history, accidents, convictions,
applicant_sensitive (encrypted), applicant_documents, signatures
```
- Row Level Security on every table. Public site inserts only via Server Actions using a server-side role; anonymous clients cannot read anything.
- Staff access later through Supabase Auth roles (`07-auth-crm-foundation.md`).
- Follows the installed `supabase-postgres-best-practices` skill (indexes on FKs, lowercase identifiers, `timestamptz`, etc.).

## Notifications (hot-lead flow, target: Ken calls within 1 hour)
1. Form submitted → row saved.
2. **Quo SMS to Ken**: "New CDL-A team applicant: Juan R., Las Vegas, 3 yrs, 0 violations — tap to call".
3. **Resend email to Ken** (from `apply@globalrunnerslogistics.com`) with full answers.
4. **Resend confirmation to applicant** (EN/ES) and, if consented, **Quo SMS**: "Thanks for applying to Global Runners Logistics. Ken will call you shortly. Reply STOP to opt out."
5. Optional later: Telegram/WhatsApp alert (client listed it).

## Compliance
- SMS consent language + SMS Terms page are prerequisites for the Quo A2P 10DLC campaign approval.
- Public quick-apply never collects SSN, DL number or DOB. Those live only in the logged-in portal application, in a separate `applicant_sensitive` table with column-level encryption (pgsodium/Vault), recruiter-only RLS, access logging, and a retention/deletion policy. Uploads go to a private bucket with short-lived signed URLs.
- EEO statement on every job page; work authorization asked as "authorized to work in the U.S.? yes/no" only.

# 09 — Deployment & Launch

## Accounts / connections status (2026-11-03)
| Service | Status |
|---|---|
| GitHub `grlbco/GlobalRunnersLogistics` | ✅ connected, empty repo |
| Supabase `ercilamdgoyypghzrwic` | ✅ connected, empty DB |
| Resend (`globalrunnerslogistics.com`, eu-west-1) | ⏳ DNS added on Hostinger, verification pending |
| Quo (725) 666-1558 | ✅ connected — A2P 10DLC status to check |
| Instantly | ✅ connected — 1 warmed mailbox, no campaigns |
| Vercel | ❌ connector dropped — reconnect needed |
| Tally | ✅ onboarding submission received |

## DNS (Hostinger)
Keep Resend records. At launch replace:
- `A @ 2.57.91.91` → Vercel apex record (value given by Vercel when domain is added)
- `CNAME www → globalrunnerslogistics.com` → Vercel CNAME
- Add Google Search Console + Bing TXT verification records.

## Launch checklist
1. All ⚠️ facts in `00-company-facts.md` confirmed by Ken.
2. No third-party carrier names/links anywhere; MC/USDOT shown only if registered to GRL.
3. Spanish copy reviewed by a native speaker.
4. Forms tested end-to-end (SMS + email received by Ken).
5. Legal pages live (privacy, terms, SMS terms, EEO).
6. Lighthouse + device matrix passed.
7. Domain on Vercel with HTTPS; `www` → apex redirect.
8. Search Console + Bing Webmaster verified, sitemaps submitted, IndexNow key live.
9. Google Business Profile + Bing Places claimed with identical NAP.
10. Analytics receiving events (apply_start, apply_submit, call_click).

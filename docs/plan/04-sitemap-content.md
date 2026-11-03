# 04 — Sitemap & Content

Audience priority: (1) CDL-A drivers in Nevada, (2) owner-operators, (3) shippers/partners checking legitimacy, (4) AI assistants and search engines answering "trucking jobs in Las Vegas".

## Navigation
Owner asked for Home · Services · About · Careers · Contact. Professionalized version:

**Drive** (mega-menu: Company Drivers · Team Drivers · Solo Drivers · Pay & Home Time · Requirements) · **Owner-Operators** · **About** · **Locations** · **Contact** · [EN/ES] · `Log in` (text link) · **Apply now** (signal button)

"Services" becomes a section on About ("What we haul"), because the site's main job is hiring. Brand everywhere: **Global Runners Logistics LLC** only — no third-party carrier names, logos or links.

## Pages

### Home `/`
1. **Hero** (Scene 1) — eyebrow `NOW HIRING CDL-A · LAS VEGAS, NV`, H1 *Your road. Your future. Our family.*, sub *Drive for a Las Vegas fleet that keeps you moving: consistent runs, weekly pay, 24/7 dispatch, and home time you can plan around.* CTAs: `Apply now` · `See pay`.
2. **Proof bar** (owner's four, made specific): `Nationwide freight — 48 states` · `Consistent runs — NV ↔ GA` · `Experienced drivers — 1 yr+ CDL-A` · `24/7 dispatch — English & Español`.
3. **01 — Why drivers stay** (client's own reasons): Pay you can count on · Consistent runs · No wait time · Home on time, not late.
4. **02 — Pay & home time** (only confirmed numbers; ⚠️ items wait for Ken): weekly pay, Thursday payday, $250 layover, $1,000 anniversary bonus each year, guaranteed weekly minimum (once confirmed).
5. **03 — The equipment** (Scene 2): Peterbilt 579 & Freightliner Cascadia, automatic, APU, inverter, fridge, microwave, road-facing camera only.
6. **04 — The lane** (Scene 3).
7. **05 — Open positions** (Scene 5 rail): Team CDL-A OTR · Solo CDL-A Regional · Solo CDL-A Dedicated → job detail pages.
8. **06 — Hiring in 3 steps**: Apply (2 min) → Call from Ken within 1 business hour → Orientation in Henderson (1 day) → first load in about 2 weeks.
9. **07 — Owner-operators** teaser.
10. **08 — FAQ** (top 6, full on `/faq`).
11. **Final CTA** + footer (Global Runners Logistics LLC, address, phone; MC/USDOT added once GRL's own numbers are confirmed).

### Drive `/drive`
Overview of company-driver jobs, pay, requirements, home time, equipment, orientation, rider/pet policy. Links to each job.

### Job detail `/drive/[job]` (each with JobPosting schema)
- `team-cdl-a-otr-las-vegas` · `solo-cdl-a-regional-las-vegas` · `solo-cdl-a-dedicated-las-vegas`
Each: summary, pay (confirmed only), miles, home time, route, equipment, requirements, schedule, orientation, how to apply, EEO line, inline short apply form.

### Owner-Operators `/owner-operators`
⚠️ Program terms needed from Ken (lease to GRL, percentage/linehaul split, truck age, insurance, fuel card/settlements). Until then: value prop (consistent freight, dispatch support, Las Vegas home base) + lead form "Tell us about your truck".

### About `/about`
Story since 2012, Ken Aman, Las Vegas office + Henderson yard, what we haul (dry van, electronics, drop & hook + live), safety standards, photos of the real fleet.

### Locations `/locations` + `/locations/[slug]`
- Core: **Las Vegas office**, **Henderson yard** (with map, hours, parking/directions for orientation).
- Hiring-area pages (pSEO, see `06-seo-geo-pseo.md`): Las Vegas, Henderson, North Las Vegas, Boulder City, Pahrump, Mesquite, Reno, Sparks, Carson City, Elko… only where Ken will truly hire, each with real local info (distance/drive time to the Henderson yard, local CDL testing sites, region's typical routes).

### Lanes `/lanes/nevada-georgia`
Corridor, typical transit, states crossed, home-time pattern.

### FAQ `/faq`
30–40 real driver questions (pay day, first check timing, riders/pets, truck home, hazmat, tickets allowed, orientation travel, Spanish dispatch…). Each answer starts with a direct one-sentence answer (good for Google and AI answers).

### Apply `/apply/driver` · `/apply/owner-operator` — see `05-forms-data.md`.

### Contact `/contact`
Phone (Quo line), email, office address, yard area, hours (Pacific), contact form, map.

### Legal
Privacy Policy · Terms · **SMS Terms** (required for A2P 10DLC + TCPA consent) · EEO statement · Accessibility statement.

### Auth (placeholder for CRM) `/login`, `/register`, `/reset` — see `07-auth-crm-foundation.md`.

## Writing rules
- Plain, direct, driver-to-driver English. Short sentences. Numbers as digits.
- Every claim backed by `00-company-facts.md`. No invented stats, awards or testimonials.
- Spanish is a native-quality translation (not machine-only), reviewed by a Spanish speaker before launch.
- Never: "AI", "green card required", benefits we don't offer, sign-on bonus wording for the anniversary bonus.

# Global Runners Logistics — Website Build Plan

Domain: **globalrunnerslogistics.com** · Repo: `grlbco/GlobalRunnersLogistics` · Owner: Ken Aman · Builder: George (CarrieX Labs / Asamblor)

A cinematic, very fast hiring website for a 30-truck Las Vegas dry-van fleet: driver + owner-operator applications, locations, full SEO/GEO, EN/ES, and auth ready for the CRM.

## Plan documents
| # | Doc | What it decides |
|---|---|---|
| 00 | [Company facts](00-company-facts.md) | Source of truth from the Tally form + items Ken must confirm |
| 01 | [Architecture](01-architecture.md) | Next.js on Vercel, "one canvas" navigation, Supabase, folder layout |
| 02 | [Design system](02-design-system.md) | Colors, fonts (Geist / General Sans), grid, components, "no AI look" rules |
| 03 | [Motion](03-motion.md) | Scroll-scrubbed real truck hero, lane map, wireframe fleet, transitions |
| 04 | [Sitemap & content](04-sitemap-content.md) | Every page and section, nav, copy rules |
| 05 | [Forms & data](05-forms-data.md) | Driver/O-O/contact forms, DB schema, Quo + Resend alerts, compliance |
| 06 | [SEO / GEO / pSEO](06-seo-geo-pseo.md) | Structured data, Google for Jobs, llms.txt, AI crawlers, location pages, GSC/Bing |
| 07 | [Auth & CRM foundation](07-auth-crm-foundation.md) | Login/register, roles, webhook stubs |
| 08 | [Quality](08-quality-performance-a11y.md) | Device matrix, performance budget, accessibility, tests |
| 09 | [Deploy & launch](09-deploy-launch.md) | DNS changes, launch checklist |

## Build steps (each ends with a preview link for review)
| Step | Deliverable | Done when |
|---|---|---|
| 1 | Repo scaffold: Next.js, TS, Tailwind v4, lint/format, i18n, Vercel project, preview deploys | Blank branded page live on a preview URL |
| 2 | Design tokens + font specimen (Geist vs General Sans) + logo as SVG | George picks font; tokens locked |
| 3 | Core components + persistent layout, header/mega-menu, mobile menu, footer, page transitions, Lenis | Navigating between stub pages feels instant with no reload |
| 4 | Home page sections with static content (no heavy motion yet) | Content approved |
| 5 | Motion pass: hero truck frame sequence, stats, lane map, job rail, footer reveal | 60fps on mid-range phone, reduced-motion fallback works |
| 6 | Drive, job detail ×3, Owner-Operators, About, Locations, Lanes, FAQ, Contact, Legal | All pages built EN |
| 7 | Supabase migration + forms + Quo/Resend notifications + consent records | Test application reaches Ken by SMS + email |
| 8 | Auth + GRL driver portal: login/register/reset, full DOT application (save & resume, uploads, e-sign), roles + RLS, encrypted sensitive data | A driver can finish a full application; only recruiters can see it |
| 9 | SEO/GEO: metadata, JSON-LD, sitemap, robots, llms.txt, OG images, pSEO location pages | Rich Results Test passes; llms.txt live |
| 10 | Spanish version + hreflang | Native review done |
| 11 | QA: device matrix, Lighthouse, a11y, Playwright | Budgets in doc 08 met |
| 12 | Launch: domain to Vercel, GSC, Bing, IndexNow, GBP/Bing Places | Site live and indexed |
| 13 (optional) | Wireframe 3D fleet scene (Three.js) | Desktop only, no perf regression |

## Status (2026-11-03)
- ✅ Steps 1–4, 6, 7, 9 built: all pages, forms → Supabase (RLS-tested), auth + portal shell, JSON-LD, sitemap, robots, llms.txt, OG image, legal drafts.
- 🟡 Step 5 motion: reveals, counters, lane map, job rail, transitions done; hero truck waits for the Pexels clip (`scripts/make-frames.sh`, `content/media.ts`).
- 🟡 Step 7 alerts: code ready; needs `RESEND_API_KEY`, `QUO_API_KEY` in Vercel (see `.env.example`) and Resend domain verified.
- 🟡 Step 8: full DOT application inside the portal is next.
- ⬜ Step 10 Spanish body copy (chrome, home and apply form are translated; other ES pages are noindex + canonical to EN until then).
- ⬜ Supabase Auth URL config: add `http://localhost:3000/**` and `https://globalrunnerslogistics.com/**` to redirect URLs; set Site URL.

## Open questions (blocking specific steps)
| # | Question | Blocks |
|---|---|---|
| 1 | **MC / USDOT:** does Global Runners Logistics LLC have its own numbers to show in the footer? (Brand decided: GRL only, no third-party carrier anywhere.) | Footer, launch |
| 2 | **Pay:** confirm team rate ($0.80–0.90/mi?), solo rate, who gets the $2,000 weekly minimum, whether 6,000 mi/wk is team, home-time pattern | Step 4 pay section, JobPosting salary |
| 3 | **Truck footage for the hero:** shoot at the Henderson yard (best), or license stock of a Peterbilt + 53' dry van? | Step 5 |
| 4 | **Owner-operator program terms** (lease to GRL, split, truck age, insurance) | Owner-Operators page |
| 5 | Speed limiter value, Hazmat required or preferred, orientation paid + location, rider/pet rules | Job pages, FAQ |
| 6 | Henderson yard street address? (Public phone decided: Ken, (312) 975-3377) | Contact, GBP |
| 7 | Social links, real photos/videos of the fleet and drivers, any real driver testimonials | About, Home |

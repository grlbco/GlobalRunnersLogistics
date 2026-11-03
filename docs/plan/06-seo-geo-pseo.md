# 06 — SEO, GEO (AI answers) & Programmatic SEO

Goal: when a driver searches Google/Bing **or asks ChatGPT, Claude, Gemini, Perplexity or Copilot** "CDL-A team jobs in Las Vegas", Global Runners Logistics shows up and is described correctly.

## 1. Technical SEO (every page)
- Server-rendered HTML, clean URLs (`/drive/team-cdl-a-otr-las-vegas`), one H1, logical H2/H3.
- Unique `<title>` (≤60 chars) + meta description (≤155) generated from content; canonical URLs; `hreflang` en/es + `x-default`.
- `sitemap.xml` (split: pages, jobs, locations, es), `robots.txt`, `manifest.webmanifest`, favicons, OG/Twitter images auto-generated per page (`next/og`) in brand style.
- Core Web Vitals targets: LCP < 2.0s, INP < 200ms, CLS < 0.05 on mobile.
- Internal linking: every location page ↔ relevant jobs ↔ FAQ; breadcrumbs everywhere.
- Preview deployments `noindex`.

## 2. Structured data (JSON-LD, generated from `content/facts.ts`)
| Page | Schema |
|---|---|
| All | `Organization` (name, logo, sameAs socials, contactPoint, foundingDate 2012), `WebSite`, `BreadcrumbList` |
| Office / yard | `LocalBusiness` (generic type — not `MovingCompany`, which means household movers) with `PostalAddress`, `geo`, `openingHours` |
| Job pages | **`JobPosting`**: title, description, datePosted, validThrough, employmentType FULL_TIME, hiringOrganization, jobLocation (Henderson, NV), baseSalary (confirmed figures only), experienceRequirements, directApply true — this makes jobs eligible for **Google for Jobs** |
| FAQ | `FAQPage` |
| Guides | `Article` with author/date |
Rules: JobPosting only on single-job detail pages; remove/expire when a role closes (Google penalizes stale jobs); validate in Rich Results Test before launch.

## 3. GEO — being cited by AI assistants
- **`/llms.txt`** (and `/llms-full.txt`): plain-Markdown summary of who GRL is, fleet, lane, pay, requirements, how to apply, key URLs. Generated from `facts.ts` so it never goes stale.
- **Answer-first writing:** every page and FAQ answer opens with a one-sentence direct answer containing the entity + facts ("Global Runners Logistics pays CDL-A drivers weekly, every Thursday.").
- **Consistent entity facts** across site, Google Business Profile, Bing Places, Facebook, Indeed/Craigslist ads (same name, address, phone = NAP consistency).
- **Fact tables** (pay, requirements, equipment) in real HTML tables, easy for models to extract.
- **Allow AI crawlers** in `robots.txt`: OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, Bingbot, Applebot-Extended (George can opt out of training bots separately from search bots).
- **Third-party mentions** matter most for AI answers: Google Business Profile, Bing Places, driver forums/Reddit answers, YouTube (real yard tour video), local Las Vegas business listings.
- **Monitoring:** monthly check of 20 target prompts across ChatGPT, Claude, Perplexity, Gemini, Copilot; log citations in the CRM later.

## 4. Programmatic SEO (pSEO) — done safely
Google's scaled-content-abuse policy punishes thin, templated doorway pages. So every generated page must carry **unique, useful data**.

| Template | Count (start) | Unique data per page |
|---|---|---|
| `/locations/[city]-nv` CDL-A jobs near {city} | ~10 Nevada cities | Drive time & miles to Henderson yard, nearest truck parking/CDL testing, local highway access (I-15, US-95, I-80), local FAQ, matching jobs |
| `/drive/[job]` | 3 (+ES) | Distinct pay/route/home time |
| `/lanes/[lane]` | 1 → more as lanes grow | Corridor, states, transit times |
| `/guides/[topic]` | 6–10 hand-written | "How team pay works", "Getting a CDL-A in Nevada", "What to bring to orientation", "Drop & hook vs live unload" |
All × 2 languages (EN/ES) with hreflang. New pages are added only when Ken actually hires there.

## 5. Google, Bing & AI search connection (at launch, Step 11)
- **Google Search Console**: verify domain via DNS TXT on Hostinger, submit sitemaps, inspect key URLs, monitor Job posting enhancement report.
- **Bing Webmaster Tools**: import from GSC, submit sitemap. Bing powers ChatGPT search and Copilot results, so this matters for GEO too.
- **IndexNow**: auto-ping Bing/Yandex/Seznam on every deploy for changed URLs.
- **Google Business Profile** for the Las Vegas office (and yard if eligible) + **Bing Places**.
- **Apple Business Connect** (Apple Maps / Siri).

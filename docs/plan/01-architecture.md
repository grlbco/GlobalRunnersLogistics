# 01 — Architecture & Stack

## Goals
1. Feels like one continuous canvas: page changes never flash white or reload; the header, smooth scroll and background persist.
2. Every page is still a real, server-rendered HTML page (critical for Google, Bing and AI crawlers).
3. Ready to grow into the CRM (auth, dashboards, MCP-connected workflows) without a rewrite.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router, latest stable) + React + TypeScript** | Static/ISR HTML for SEO + client-side soft navigation for the "stay in canvas" feel |
| Hosting | **Vercel** (project under the grlbco team) | Edge CDN, image optimization, preview deploys per branch |
| Styling | **Tailwind CSS v4** + CSS variables for tokens | Fast, consistent, tiny CSS output |
| Motion | **GSAP + ScrollTrigger** (scroll-scrubbed scenes), **Motion** (`motion/react`) for UI micro-interactions, **Lenis** smooth scroll | Industry standard for award-level sites; GSAP is free incl. plugins |
| 3D (optional section) | **Three.js via React Three Fiber**, lazy-loaded | Wireframe fleet scene inspired by Terminal Industries |
| Page transitions | Persistent root layout + **View Transitions API** (with Motion fallback) | No full reload; header/canvas stay mounted |
| Forms | React Hook Form + Zod, Server Actions | Typed validation on client and server |
| Database / Auth | **Supabase** (project `ercilamdgoyypghzrwic`, us-east-1) with `@supabase/ssr` | Already connected; same DB the CRM will use |
| Email | **Resend** from `globalrunnerslogistics.com` | Domain added; verifying DNS on Hostinger |
| SMS alerts | **Quo** (725) 666-1558 | Hot-lead texts to Ken (`05-forms-data.md`) |
| Analytics | Vercel Analytics + Speed Insights; GA4 optional | Privacy-light, Core Web Vitals tracking |
| i18n | `/` English, `/es` Spanish (next-intl) | Dispatch speaks Spanish; campaign languages EN + ES |
| Content | Typed content files in repo (`/content/*.ts` + MDX for guides) | No CMS cost now; easy for us to edit; CRM can take over later |

## How the "one canvas" feel works
- `app/[locale]/layout.tsx` holds the header, the Lenis instance, the cursor/visual layer and a `<TransitionProvider>`. It never unmounts.
- Links use Next `<Link>` with prefetch → HTML/JS for the next page is already cached when clicked.
- On navigation the outgoing page content fades/clips out, the new one animates in (View Transitions where supported).
- ScrollTrigger instances are killed and rebuilt per route; scroll restores to top with a short eased scroll.
- Result: instant like a single-page app, but every URL is crawlable HTML.

## Folder structure (planned)
```
app/
  [locale]/
    (marketing)/          # public site
      page.tsx            # Home
      drive/              # company driver jobs + job detail pages
      owner-operators/
      about/
      locations/[slug]/   # Las Vegas, Henderson + hiring-area city pages
      lanes/[slug]/
      faq/
      contact/
      apply/driver/
      apply/owner-operator/
      legal/(privacy|terms|sms-terms|eeo)/
    (auth)/login, register, reset/
    (app)/dashboard/      # placeholder for CRM, protected
  api/                    # webhooks (Tally, Resend, Quo) later
  sitemap.ts, robots.ts, llms.txt/route.ts, manifest.ts
components/  (ui/, motion/, sections/, forms/)
content/     (facts.ts, jobs.ts, locations.ts, faq.ts, lanes.ts — all typed)
lib/         (supabase/, seo/, schema/, i18n/, analytics/)
public/      (fonts/, frames/truck/, images/, og/)
supabase/    (migrations/, seed.sql)
docs/plan/   (this folder)
```

## Single source of facts
`content/facts.ts` mirrors `00-company-facts.md`. Pages, JSON-LD, `llms.txt` and FAQ all read from it, so a pay change is edited once and updates everywhere (including structured data Google reads).

## Environments
- `main` → production (globalrunnerslogistics.com)
- PR branches → Vercel preview URLs (password-protected, `noindex`)
- Secrets live in Vercel env vars, never in git.

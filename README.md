# Global Runners Logistics — globalrunnerslogistics.com

Hiring website, driver portal and (next) CRM for Global Runners Logistics LLC, a CDL-A dry-van fleet in Las Vegas, NV.

- Plan & decisions: [`docs/plan/`](docs/plan/README.md)
- Company facts (single source of truth): [`content/facts.ts`](content/facts.ts)

## Stack
Next.js 16 (App Router, Cache Components) · React 19 · Tailwind CSS v4 · GSAP + Lenis + Motion · Supabase · Resend · Quo · Vercel

## Develop
```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

Routes: English at `/`, Spanish at `/es` (rewritten internally to `app/[lang]` by `proxy.ts`).
Indexing is disabled until launch; set `NEXT_PUBLIC_ALLOW_INDEXING=true` in production.
Internal design specimen: `/design` (noindex).

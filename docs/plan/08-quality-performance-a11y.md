# 08 — Quality: Performance, Devices, Accessibility, Testing

## Device matrix (must look designed, not just "responsive")
| Breakpoint | Width | Notes |
|---|---|---|
| Small phone | 360–389 | iPhone SE / small Android; hero uses mobile frame set |
| Phone | 390–430 | iPhone 15/16/17, Pixel; primary target (drivers browse on phones) |
| Tablet | 768–1024 | iPad portrait/landscape |
| Laptop | 1280–1440 | |
| Desktop / wide | 1920–2560 | Max content width 1440, imagery goes full-bleed |
Also: truck-cab reality — one-handed use, large tap targets (≥48px), forms work with autofill, visible "Call" button sticky on mobile.

## Performance budget
- JS on first load ≤ 170 KB gzip on Home (GSAP/Three lazy-loaded per scene).
- LCP image ≤ 120 KB (AVIF). Fonts: 2 files max preloaded.
- Lighthouse mobile: Performance ≥ 90, Accessibility 100, Best Practices 100, SEO 100.

## Accessibility (WCAG 2.2 AA)
- Full keyboard navigation, visible focus rings in signal color, skip link.
- `prefers-reduced-motion` → all scrubbed scenes become static compositions.
- Color contrast AA; form errors announced (aria-live), labels on all fields.
- Spanish pages set `lang="es"`.

## Testing
- Playwright: screenshots at 6 widths for every page (visual review), form submission end-to-end against a Supabase branch, navigation/transition smoke tests.
- Lighthouse CI on each preview deploy.
- Rich Results Test + Schema validator for JobPosting/FAQ/Organization.
- Manual: real iPhone + Android check of hero scroll, forms, call buttons.

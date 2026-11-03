# 02 — Design System

## Direction
Industrial editorial. Calm, confident, engineered — closer to an aerospace or architecture firm than a typical trucking site. References: Terminal Industries (cinematic dusk truck, wireframe yard, huge type), the black/orange freight template (bold blocks, numbered sections), the floating-card deck (Swiss grid, index numbers, metrics).

### "No AI look" rules (hard rules)
- No gradients-on-everything, glows, sparkles, purple/blue neon, glassmorphism blobs, "✨" icons, robot/brain/chip imagery.
- No words: AI, smart, intelligent, revolutionary, unleash, seamless, cutting-edge, next-gen, empower, elevate.
- No AI-generated photos of trucks or people. Only real photography (client photos + licensed stock) and real footage.
- No generic stock icons sets; icons are thin custom line icons drawn on a 24px grid, used sparingly.
- Buttons are plain words: "Apply now", "Call dispatch", "See pay", "Lease on".

## Color
Built from the logo (navy + brushed silver) plus one signal color for action.

| Token | Hex (proposed) | Use |
|---|---|---|
| `--ink` | `#0A1220` | Primary dark background (night road) |
| `--navy` | `#13213A` | Logo navy, surfaces |
| `--steel` | `#2A3A55` | Borders, dividers on dark |
| `--silver` | `#C7CDD6` | Logo silver, secondary text on dark |
| `--fog` | `#EEF0F3` | Light sections background |
| `--white` | `#FFFFFF` | Text on dark, cards |
| `--signal` | `#E8401C` | CTAs, active states, key numbers (bridges owner's red and the orange references) |
| `--signal-ink` | `#B32E10` | CTA hover / pressed |
| `--dusk` | `#F2A65A` | Used only inside the hero sunset footage overlays |

Ratios: ~70% ink/navy, 20% fog/white, ≤10% signal. Contrast checked to WCAG AA (signal on ink passes for large text and buttons with white label).

## Typography
Requirement: Apple-like, minimalist, free license, close to Eina 03.

| Role | Font | License | Notes |
|---|---|---|---|
| Display + UI (default) | **Geist Sans** | SIL OFL 1.1 | Neutral, SF-like proportions, variable weights 100–900 |
| Alt display (to compare) | **General Sans** (Fontshare) | ITF Free Font License (commercial OK) | Closest free match to Eina 03's geometric grotesk feel |
| Data / labels / index numbers | **Geist Mono** | SIL OFL 1.1 | Terminal-style technical labels: `01 — FLEET`, `MC 161864` |

Step 2 of the build renders a specimen page with Geist vs General Sans side by side; George picks one, then it's locked. Fonts are self-hosted (`next/font/local`), subset to Latin + Latin-Ext (Spanish), `font-display: swap`.

Type scale (fluid, `clamp()`):
- Display XL 72→168px, weight 600, tracking -0.04em (hero words)
- Display 48→96px · H2 32→56px · H3 22→32px
- Body 17→19px, line-height 1.55 · Small 14px · Mono label 12px uppercase +0.08em

## Layout
- 12-column grid, 1440 max content, 24px gutters (16 mobile), generous vertical rhythm (160px section spacing desktop).
- Section index system: every section has a mono label `0X — NAME` top-left (Swiss/editorial cue from the references).
- Hard edges, small radii (4px buttons, 8px cards). The freight reference's notched "folder" card corner is our signature shape for job cards.

## Components (built in Step 3)
Header (transparent → solid on scroll, mega-menu for Drive/Owner-Ops) · Mobile menu (full-screen, staggered) · Buttons (primary signal, secondary outline, text link with arrow) · Stat block · Job card (notched) · Pay calculator card · Location card · Lane map · FAQ accordion · Testimonial card (only real quotes) · Form fields (large, thumb-friendly, step progress) · Footer (big wordmark, legal, company line) · Toast · Language switch EN/ES.

## Imagery
- Hero: real footage of a Peterbilt pulling a 53' dry van at dusk (see `03-motion.md`).
- Client photos from Tally upload + a short photo/video shoot at the Henderson yard (recommended before launch; real trucks and drivers are the best trust signal).
- Treatment: slight cool grade, crushed blacks, film grain 2–3%, consistent across all photos.

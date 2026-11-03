# 03 — Motion & Animation

Principle: motion explains the business (a truck moving down the road as you move down the page), it never decorates for its own sake. Everything runs at 60fps on a mid-range phone or it gets simplified.

## Global
- **Lenis** smooth scroll (lerp ~0.1), synced to GSAP ticker; disabled for `prefers-reduced-motion`.
- **Easing:** one house curve `cubic-bezier(0.22, 1, 0.36, 1)` for entrances, `power3.inOut` for scrubbed scenes.
- **Text reveals:** headlines split by line (GSAP SplitText), lines rise from a mask, 60ms stagger. Body copy fades up once.
- **Page transitions:** outgoing content clips upward (signal-colored 4px progress line across the top), incoming content reveals from below; header stays put.
- **Hover:** buttons fill from left in signal; cards lift 4px with a shadow; links get an animated underline.
- **Cursor:** native cursor kept (accessibility); on job cards a small "View" label follows (desktop only).

## Scene 1 — Hero: the truck on the road (scroll-scrubbed)
What the visitor sees: dusk highway, a real Peterbilt + 53' dry van. As they scroll, the truck drives toward/past the camera; headline words "YOUR ROAD. / YOUR FUTURE. / OUR FAMILY." swap in sync; at the end the camera settles on the trailer side where the first section begins.

How it's built (Apple AirPods-page technique):
1. Source (decided 2026-11-03): **Pexels** footage of an American tractor + dry van (Pexels license: free for commercial use, no attribution required; must not imply endorsement by brands visible in the shot, so avoid clips with another carrier's logo on the trailer). Shortlist: Oregon sunset aerial `18749847` (4K, 60fps), desert sunset aerial `9339061` (4K), red semi mountains `17899033` (1080p), night highway `5266051` (4K). Later swap for a shoot of their own Peterbilt 579 at the Henderson yard if possible.
2. Export ~150 frames → AVIF/WebP at 3 sizes (mobile 720w, tablet 1280w, desktop 1920w).
3. `<canvas>` draws the frame matching scroll progress inside a pinned 300vh section (GSAP ScrollTrigger `scrub: 0.5`).
4. First frame is a real `<img>` (LCP-friendly, preloaded); frames stream in after load, in order, using `requestIdleCallback`.
5. Budget: ≤ 2.5 MB desktop, ≤ 1.2 MB mobile for the whole sequence.
6. Reduced-motion / Save-Data: show the poster image with a still headline, no scrub.

## Scene 2 — "Built for the long haul" (stats)
Pinned split screen. Left: big mono counters roll up (30 trucks · since 2012 · NV ↔ GA · 24/7 dispatch). Right: close-up stills (APU, cab, dash) crossfade per stat.

## Scene 3 — The lane (Nevada → Georgia)
Minimal US map in thin silver lines. On scroll an SVG path draws from Henderson, NV to Georgia along the typical interstate corridor (exact route confirmed with Ken — don't publish a route they don't run); small mono labels tick by (states, miles). Ends with "Home on time" message.

## Scene 4 — Wireframe fleet (Terminal-inspired, optional/progressive)
Three.js scene: wireframe Peterbilt + 53' trailer models (licensed GLB) parked in a yard grid, camera dollies across as you scroll; one truck "fills in" solid. Lazy-loaded only on desktop with WebGL2; mobile gets a pre-rendered video loop of the same scene.

## Scene 5 — Job cards
Horizontal scroll rail on desktop (pinned, scroll converts to x-movement), native swipe carousel on mobile. Cards use the notched corner shape.

## Scene 6 — Footer
Giant "GLOBAL RUNNERS" wordmark rises in, silver outline that fills on reveal.

## Performance rules
- All scroll scenes use transforms/opacity or canvas only (no layout-thrashing properties).
- `will-change` applied only while a scene is active.
- Heavy scenes (`Scene 1` frames, `Scene 4` WebGL) load after first paint; nothing blocks LCP.
- Each scene ships a static fallback. Target: Lighthouse Performance ≥ 90 mobile with motion on.

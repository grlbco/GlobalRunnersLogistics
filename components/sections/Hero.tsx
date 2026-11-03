"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { ButtonLink } from "@/components/ui/Button";
import { fleet } from "@/content/facts";
import type { Dictionary } from "@/dictionaries/en";
import type { Anchor, CamState, HeroScene } from "@/lib/three/heroScene";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

type SceneModule = typeof import("@/lib/three/heroScene") & { rig: import("@/lib/three/w990").RigGeometry };

/** Camera keyframes per breakpoint: front three-quarter → side profile → aerial over the yard. */
const SHOTS: Record<"desktop" | "mobile", [CamState, CamState, CamState]> = {
  desktop: [
    { x: 80, y: 7.5, z: 50, lx: -30, ly: 11.5, lz: -6 },
    { x: 2, y: 10, z: 112, lx: 2, ly: 9.5, lz: 0 },
    { x: -40, y: 165, z: 120, lx: -24, ly: 0, lz: -52 },
  ],
  mobile: [
    { x: 96, y: 15, z: 80, lx: 12, ly: -16, lz: 10 },
    { x: -2, y: 16, z: 150, lx: -2, ly: 12, lz: 0 },
    { x: -24, y: 230, z: 170, lx: -14, ly: 0, lz: -60 },
  ],
};

export function Hero({
  hero,
  proof,
  applyHref,
  payHref,
}: {
  hero: Dictionary["hero"];
  proof: Dictionary["proof"];
  applyHref: string;
  payHref: string;
}) {
  const root = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mod, setMod] = useState<SceneModule | null>(null);

  // Three.js is code-split: it loads after first paint and never blocks the headline (LCP).
  useEffect(() => {
    let alive = true;
    Promise.all([import("@/lib/three/heroScene"), import("@/lib/three/w990")])
      .then(async ([scene, w990]) => {
        const rig = await w990.loadRig();
        if (alive) setMod({ ...scene, rig });
      })
      .catch((e) => console.error("hero scene load failed", e));
    return () => {
      alive = false;
    };
  }, []);

  // 1) Intro: headline characters rise out of line masks, then copy, CTAs and proof bar.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add({ motion: "(prefers-reduced-motion: no-preference)" }, () => {
        const split = SplitText.create("[data-hero-title]", { type: "lines,chars", mask: "lines", linesClass: "pb-[0.06em]" });
        const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
        tl.from("[data-hero-eyebrow]", { autoAlpha: 0, y: 14, duration: 0.8 }, 0.15)
          .from(split.chars, { yPercent: 115, duration: 1.15, stagger: 0.018 }, 0.25)
          .from("[data-hero-sub]", { autoAlpha: 0, y: 18, duration: 0.9 }, "-=0.7")
          .from("[data-hero-cta] > *", { autoAlpha: 0, y: 18, duration: 0.8, stagger: 0.08 }, "<0.1")
          .from("[data-hero-proof] li", { autoAlpha: 0, y: 24, duration: 0.8, stagger: 0.07 }, "<0.1")
          .from("[data-hero-cue]", { autoAlpha: 0, duration: 0.8 }, "<0.3");
      });
    },
    { scope: root },
  );

  // 2) Scene + scroll choreography (runs once the 3D module has loaded).
  useGSAP(
    () => {
      const canvas = canvasRef.current;
      const el = root.current;
      if (!mod || !canvas || !el) return;

      const mm = gsap.matchMedia();
      mm.add(
        { desktop: "(min-width: 768px)", mobile: "(max-width: 767px)", reduce: "(prefers-reduced-motion: reduce)" },
        (ctx) => {
          const { desktop, reduce } = ctx.conditions as { desktop: boolean; mobile: boolean; reduce: boolean };
          const shots = SHOTS[desktop ? "desktop" : "mobile"];
          let scene: HeroScene;
          try {
            scene = mod.createHeroScene(canvas, mod.rig, { mobile: !desktop, fleetCount: desktop ? 10 : 6 });
          } catch (e) {
            console.error("hero scene init failed", e);
            return; // no WebGL: the dusk gradient and copy still stand on their own
          }
          Object.assign(scene.cam, shots[0]);
          gsap.set(canvas, { autoAlpha: 1 });

          const callouts = gsap.utils.toArray<HTMLElement>("[data-callout]", el);
          const placeCallouts = () => {
            for (const c of callouts) {
              const p = scene.project(c.dataset.callout as Anchor);
              c.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
            }
          };

          // Only render while the hero is on screen (gsap-performance: pause off-screen work).
          let active = true;
          ScrollTrigger.create({ trigger: el, start: "top bottom", end: "bottom top", onToggle: (self) => (active = self.isActive) });
          const tick = () => {
            if (!active) return;
            scene.render();
            placeCallouts();
          };
          gsap.ticker.add(tick);
          const onResize = () => scene.resize();
          window.addEventListener("resize", onResize);

          if (reduce) {
            scene.drive.speed = 0;
            scene.intro.value = 1;
            scene.render();
            return () => {
              gsap.ticker.remove(tick);
              window.removeEventListener("resize", onResize);
              scene.dispose();
            };
          }

          // Arrival: the rig fades up out of the dusk while the camera eases in.
          const start = shots[0];
          gsap.fromTo(scene.intro, { value: 0 }, { value: 1, duration: 2.4, ease: "power2.out", delay: 0.2 });
          gsap.from(scene.cam, { x: start.x + 26, z: start.z + 16, y: start.y + 3, duration: 3.2, ease: "power3.out" });

          // Mouse parallax (desktop): quickTo reuses one tween per axis.
          let onMove: ((e: PointerEvent) => void) | undefined;
          if (desktop) {
            const px = gsap.quickTo(scene.parallax, "x", { duration: 1.4, ease: "power3" });
            const py = gsap.quickTo(scene.parallax, "y", { duration: 1.4, ease: "power3" });
            onMove = (e) => {
              px((e.clientX / window.innerWidth - 0.5) * 6);
              py((e.clientY / window.innerHeight - 0.5) * -3);
            };
            window.addEventListener("pointermove", onMove, { passive: true });
          }

          // Scroll story — one top-level timeline owns the ScrollTrigger (gsap-scrolltrigger rule).
          const tl = gsap.timeline({
            defaults: { ease: "power2.inOut" },
            scrollTrigger: { trigger: el, start: "top top", end: "bottom bottom", scrub: 0.35 }, // Lenis already smooths; keep this catch-up short
          });
          tl.addLabel("intro", 0)
            .to("[data-hero-intro]", { autoAlpha: 0, yPercent: -12, duration: 1.4, ease: "power1.in" }, 0.15)
            .to("[data-hero-cue]", { autoAlpha: 0, duration: 0.5 }, 0)
            .to(scene.cam, { ...shots[1], duration: 3.4 }, 0.3)
            // Scan: orange plane sweeps nose → tail, turning the solid rig into a wireframe.
            .addLabel("scan", 1.1)
            .to(scene.scan, { glow: 1, duration: 0.4, ease: "none" }, "scan")
            .fromTo(scene.scan, { x: 12 }, { x: -70, duration: 3, ease: "none" }, "scan")
            .to(scene.scan, { glow: 0, duration: 0.4, ease: "none" }, "scan+=2.7")
            .addLabel("spec", 3.6)
            .fromTo("[data-hero-spec]", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1, ease: "power2.out" }, "spec")
            .fromTo(callouts, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, stagger: 0.25, ease: "none" }, "spec+=0.2")
            .to(["[data-hero-spec]", ...callouts], { autoAlpha: 0, duration: 0.8, ease: "power1.in" }, "spec+=2.6")
            // Yard: the rig rolls to a stop, the camera rises, the fleet appears.
            .addLabel("yard", 6.4)
            .to(scene.drive, { speed: 0, duration: 2.6, ease: "power2.out" }, "yard-0.4")
            .to(scene.cam, { ...shots[2], duration: 3.4 }, "yard")
            .to("[data-hero-night]", { autoAlpha: 1, duration: 3 }, "yard-0.6")
            .to(scene.fleetOpacity, { value: 1, duration: 2.2, ease: "power1.out" }, "yard+=0.8")
            .fromTo("[data-hero-fleet]", { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1.4, ease: "power3.out" }, "yard+=1.6")
            .to({}, { duration: 0.8 });

          return () => {
            gsap.ticker.remove(tick);
            window.removeEventListener("resize", onResize);
            if (onMove) window.removeEventListener("pointermove", onMove);
            scene.dispose();
          };
        },
      );
    },
    { scope: root, dependencies: [mod] },
  );

  return (
    <section ref={root} id="hero" className="relative h-[300svh]" aria-label="Global Runners Logistics — now hiring">
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* Sky: dusk, deepening to night as the camera rises over the yard */}
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,#070d18_0%,#0e1628_38%,#1a1d2e_56%,#2b2230_66%,#121827_74%,#0a1220_100%)]" />
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_32%_at_68%_62%,rgba(242,166,90,0.28)_0%,rgba(232,64,28,0.08)_40%,transparent_72%)]" />
        <div data-hero-night aria-hidden className="invisible absolute inset-0 bg-ink opacity-0" />
        <div aria-hidden className="grain absolute inset-0 overflow-hidden" />

        <canvas ref={canvasRef} aria-hidden className="invisible absolute inset-0 h-full w-full opacity-0" />

        {/* Legibility scrims */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/25 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink via-ink/50 to-transparent" />

        {/* Phase 1 — headline */}
        <div data-hero-intro className="container-site relative z-10 flex h-full flex-col justify-end pb-24 pt-28 sm:pb-10 md:pb-12">
          <p data-hero-eyebrow className="label flex items-center gap-3 text-white/80">
            <span className="h-2 w-2 rounded-full bg-signal" />
            {hero.eyebrow}
          </p>
          <h1 data-hero-title className="mt-6 max-w-[14ch] text-[clamp(2.75rem,min(1.2rem+6.2vw,10.5svh),8.75rem)] font-semibold leading-[0.9] tracking-[-0.045em]">
            {hero.titleLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <div className="mt-8 flex max-w-[34rem] flex-col gap-8 md:mt-10">
            <p data-hero-sub className="body-lg max-w-[34rem] text-white/75">
              {hero.sub}
            </p>
            <div data-hero-cta className="flex flex-wrap gap-3">
              <ButtonLink href={applyHref} arrow className="h-14 px-7">
                {hero.primary}
              </ButtonLink>
              <ButtonLink href={payHref} variant="outline" className="h-14 px-7 backdrop-blur-sm">
                {hero.secondary}
              </ButtonLink>
            </div>
          </div>
          <ul data-hero-proof className="mt-14 hidden grid-cols-2 border-t border-white/15 md:grid md:grid-cols-4">
            {proof.map((item, i) => (
              <li
                key={item.k}
                className="flex flex-col gap-1.5 border-white/15 py-5 pr-4 [&:nth-child(odd)]:border-r md:border-r md:px-6 md:first:pl-0 md:last:border-r-0"
              >
                <span className="label text-white/45">0{i + 1}</span>
                <span className="text-[0.95rem] font-medium md:text-base">{item.k}</span>
                <span className="text-sm text-white/55">{item.v}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Phase 2 — spec callouts pinned to the rig */}
        <div data-hero-spec className="invisible pointer-events-none absolute inset-x-0 top-24 z-10 opacity-0 md:top-32">
          <div className="container-site">
            <p className="label text-white/50">{fleet.trailer} · {fleet.transmission}</p>
            <p className="h2 mt-3 max-w-[18ch]">Built for the long haul.</p>
            <ul className="mt-6 space-y-2 border-l border-signal/60 pl-4 text-white/80 md:hidden">
              <li>{fleet.makes.join(" · ")}</li>
              <li>{fleet.trailer} · {fleet.freight}</li>
              <li>APU · Inverter · Fridge · Microwave</li>
            </ul>
          </div>
        </div>
        {[
          { key: "cab", k: "Tractor", v: `${fleet.transmission} · APU · Inverter` },
          { key: "trailer", k: "Trailer", v: `${fleet.trailer} · ${fleet.freight}` },
          { key: "wheels", k: "Camera", v: "Road-facing only" },
        ].map((c) => (
          <div key={c.key} data-callout={c.key} className="invisible pointer-events-none absolute left-0 top-0 z-10 hidden opacity-0 will-change-transform md:block">
            <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full border border-signal bg-ink" />
            <span
              className={
                c.key === "wheels"
                  ? "absolute left-0 top-0 h-16 w-px bg-gradient-to-b from-signal to-transparent"
                  : "absolute left-0 top-0 h-16 w-px -translate-y-full bg-gradient-to-t from-signal to-transparent"
              }
            />
            <span className={`absolute left-3 block w-max max-w-[15rem] border-l border-white/20 pl-3 ${c.key === "wheels" ? "top-12" : "-top-20"}`}>
              <span className="label block text-signal">{c.k}</span>
              <span className="mt-1 block text-sm text-white/85 md:text-[0.95rem]">{c.v}</span>
            </span>
          </div>
        ))}

        {/* Phase 3 — the yard */}
        <div data-hero-fleet className="invisible pointer-events-none absolute inset-x-0 bottom-16 z-10 opacity-0 md:bottom-24">
          <div className="container-site flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <p className="display-xl leading-[0.85]">
              {fleet.trucks}
              <span className="block text-[0.32em] font-medium tracking-[-0.03em] text-white/80">trucks. One yard in Henderson, NV.</span>
            </p>
            <p className="body-lg max-w-sm text-white/65">A dedicated dispatcher for every driver, 24/7, in English and Spanish.</p>
          </div>
        </div>

        {/* Scroll cue */}
        <div data-hero-cue aria-hidden className="absolute right-6 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-center gap-3 lg:flex">
          <span className="label text-white/45">Scroll</span>
          <span className="relative h-10 w-px overflow-hidden bg-white/15">
            <span className="absolute inset-x-0 top-0 h-1/2 animate-[cue_1.8s_cubic-bezier(.22,1,.36,1)_infinite] bg-white" />
          </span>
        </div>
      </div>
    </section>
  );
}

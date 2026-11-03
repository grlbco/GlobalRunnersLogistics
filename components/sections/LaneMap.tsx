"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Abstract lane: Henderson, NV → Georgia drawn on a dot grid as the user scrolls.
 * Exact interstate route is intentionally not shown until confirmed (docs/plan/03).
 */
export function LaneMap() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const path = el.querySelector<SVGPathElement>("[data-route]");
    const truck = el.querySelector<SVGGElement>("[data-truck]");
    const ticks = el.querySelectorAll<SVGTextElement>("[data-tick]");
    if (!path || !truck) return;
    const len = path.getTotalLength();

    const ctx = gsap.context(() => {
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: reduce ? 0 : len });
      if (reduce) return;
      const state = { p: 0 };
      gsap
        .timeline({
          scrollTrigger: { trigger: el, start: "top 70%", end: "bottom 45%", scrub: 0.6 },
        })
        .to(path, { strokeDashoffset: 0, ease: "none" }, 0)
        .to(
          state,
          {
            p: 1,
            ease: "none",
            onUpdate: () => {
              const pt = path.getPointAtLength(state.p * len);
              truck.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
            },
          },
          0,
        )
        .fromTo(ticks, { opacity: 0, y: 6 }, { opacity: 1, y: 0, stagger: 0.25, ease: "none" }, 0.05);
    }, el);
    return () => ctx.revert();
  }, []);

  const W = 1200;
  const H = 520;
  const dots = [];
  for (let x = 20; x < W; x += 24) for (let y = 20; y < H; y += 24) dots.push([x, y]);

  return (
    <div ref={root} className="relative mt-16 overflow-x-auto rounded-lg border border-white/10 bg-ink [scrollbar-width:none] md:mt-24 [&::-webkit-scrollbar]:hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[760px]" role="img" aria-label="Main lane: Henderson, Nevada to Georgia">
        <g fill="#c7cdd6" opacity="0.14">
          {dots.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" />
          ))}
        </g>
        <path d="M150 230 C 380 120, 640 360, 1050 330" fill="none" stroke="#c7cdd6" strokeOpacity="0.15" strokeWidth="2" strokeDasharray="2 8" />
        <path data-route d="M150 230 C 380 120, 640 360, 1050 330" fill="none" stroke="#e8401c" strokeWidth="3" strokeLinecap="round" />
        {/* endpoints */}
        <g>
          <circle cx="150" cy="230" r="9" fill="#0a1220" stroke="#fff" strokeWidth="2" />
          <text x="150" y="196" textAnchor="middle" className="fill-white font-mono text-[15px] tracking-widest">HENDERSON, NV</text>
          <text x="150" y="268" textAnchor="middle" className="fill-white/50 font-mono text-[12px] tracking-widest">YARD · ORIENTATION</text>
        </g>
        <g>
          <circle cx="1050" cy="330" r="9" fill="#0a1220" stroke="#fff" strokeWidth="2" />
          <text x="1050" y="296" textAnchor="middle" className="fill-white font-mono text-[15px] tracking-widest">GEORGIA</text>
        </g>
        <text data-tick x="420" y="120" textAnchor="middle" className="fill-white/60 font-mono text-[12px] tracking-widest">48-STATE OTR</text>
        <text data-tick x="610" y="330" textAnchor="middle" className="fill-white/60 font-mono text-[12px] tracking-widest">53&apos; DRY VAN · ELECTRONICS</text>
        <text data-tick x="860" y="410" textAnchor="middle" className="fill-white/60 font-mono text-[12px] tracking-widest">DROP &amp; HOOK + LIVE</text>
        <g data-truck transform="translate(150 230)">
          <circle r="16" fill="#e8401c" opacity="0.2" />
          <circle r="6" fill="#e8401c" />
        </g>
      </svg>
    </div>
  );
}

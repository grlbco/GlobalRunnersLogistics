"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Arrow } from "@/components/ui/Button";

gsap.registerPlugin(ScrollTrigger);

type Card = { href: string; index: string; title: string; meta: string; summary: string };

/** Desktop: pinned horizontal rail driven by vertical scroll. Mobile: native swipe. */
export function JobsRail({ cards, cta }: { cards: Card[]; cta: { href: string; label: string } }) {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
      const t = track.current;
      const w = wrap.current;
      if (!t || !w) return;
      const distance = () => Math.max(0, t.scrollWidth - w.clientWidth);
      gsap.to(t, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: { trigger: w, start: "top top+=96", end: () => `+=${distance()}`, scrub: 0.6, pin: true, invalidateOnRefresh: true },
      });
    });
    return () => mm.revert();
  }, []);

  return (
    <div ref={wrap} className="mt-14 md:mt-20">
      <div
        ref={track}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group relative flex min-h-[26rem] w-[84vw] shrink-0 snap-start flex-col justify-between bg-navy p-7 transition-colors duration-500 hover:bg-steel sm:w-[26rem] lg:w-[30rem]"
            style={{ clipPath: "polygon(0 0, calc(100% - 44px) 0, 100% 44px, 100% 100%, 0 100%)" }}
          >
            <div className="flex items-start justify-between">
              <span className="label text-white/45">{c.index}</span>
              <span className="label rounded-full border border-white/20 px-3 py-1.5 text-white/70">Hiring</span>
            </div>
            <div>
              <p className="label text-signal">{c.meta}</p>
              <h3 className="h3 mt-3">{c.title}</h3>
              <p className="mt-4 text-white/60">{c.summary}</p>
              <span className="mt-8 inline-flex items-center gap-2 text-[0.95rem] font-medium">
                View job <Arrow className="transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
        <Link
          href={cta.href}
          className="group flex min-h-[26rem] w-[84vw] shrink-0 snap-start flex-col justify-between bg-signal p-7 sm:w-[26rem] lg:w-[30rem]"
        >
          <span className="label text-white/70">→</span>
          <span className="display block max-w-[8ch]">{cta.label}</span>
          <Arrow className="h-6 w-6 transition-transform duration-300 group-hover:translate-x-2" />
        </Link>
      </div>
    </div>
  );
}

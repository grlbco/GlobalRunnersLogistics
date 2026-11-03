"use client";

import { motion } from "motion/react";
import { ButtonLink } from "@/components/ui/Button";
import type { Dictionary } from "@/dictionaries/en";

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Hero shell. The scroll-scrubbed truck sequence (docs/plan/03, Scene 1) drops into the
 * <HeroMedia> slot once the Pexels clip is chosen; until then a still road composition holds the space.
 */
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
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden">
      <HeroMedia />

      <div className="container-site relative z-10 flex flex-1 flex-col justify-end pb-10 pt-32 md:pb-14">
        <motion.p
          className="label flex items-center gap-3 text-white/80"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease, delay: 0.2 }}
        >
          <span className="h-2 w-2 rounded-full bg-signal" />
          {hero.eyebrow}
        </motion.p>

        <h1 className="display-xl mt-6 max-w-[14ch]">
          {hero.titleLines.map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.06em]">
              <motion.span
                className="block"
                initial={{ y: "105%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 1.1, ease, delay: 0.3 + i * 0.09 }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        <div className="mt-8 flex flex-col gap-8 md:mt-10 md:flex-row md:items-end md:justify-between">
          <motion.p
            className="body-lg max-w-[34rem] text-white/75"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.7 }}
          >
            {hero.sub}
          </motion.p>
          <motion.div
            className="flex flex-wrap gap-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.8 }}
          >
            <ButtonLink href={applyHref} arrow className="h-14 px-7">
              {hero.primary}
            </ButtonLink>
            <ButtonLink href={payHref} variant="outline" className="h-14 px-7">
              {hero.secondary}
            </ButtonLink>
          </motion.div>
        </div>

        <motion.ul
          className="mt-12 grid grid-cols-2 border-t border-white/15 md:mt-16 md:grid-cols-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
        >
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
        </motion.ul>
      </div>
    </section>
  );
}

/** Placeholder road at dusk, drawn in SVG (no stock, no AI imagery). Replaced by real footage frames. */
function HeroMedia() {
  return (
    <div aria-hidden className="grain absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_75%_38%,#f2a65a33_0%,#13213a_42%,#0a1220_75%)]" />
      <svg className="absolute inset-x-0 bottom-0 h-[62%] w-full" viewBox="0 0 1600 600" preserveAspectRatio="none">
        <defs>
          <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#13213a" stopOpacity="0" />
            <stop offset="1" stopColor="#060b14" />
          </linearGradient>
        </defs>
        <path d="M1180 0 L1600 600 L0 600 L1120 0 Z" fill="url(#road)" />
        <path d="M1150 0 L800 600" stroke="#c7cdd6" strokeOpacity="0.35" strokeWidth="3" strokeDasharray="28 36" />
        <path d="M1122 0 L0 560" stroke="#c7cdd6" strokeOpacity="0.15" strokeWidth="2" />
        <path d="M1178 0 L1600 520" stroke="#c7cdd6" strokeOpacity="0.15" strokeWidth="2" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-ink/20 to-transparent" />
    </div>
  );
}

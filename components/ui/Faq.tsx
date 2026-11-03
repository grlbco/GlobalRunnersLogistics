"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import type { Faq } from "@/content/faq";

/** Accordion. Answers stay in the DOM for crawlers (hidden visually when closed). */
export function FaqList({ items, tone = "dark" }: { items: readonly Faq[]; tone?: "dark" | "light" }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className={clsx("border-t", tone === "light" ? "border-ink/15" : "border-white/15")}>
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <li key={f.q} className={clsx("border-b", tone === "light" ? "border-ink/15" : "border-white/15")}>
            <h3>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-6 py-6 text-left text-lg font-medium tracking-[-0.01em] md:text-xl"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                {f.q}
                <span className="relative mt-2 h-3 w-3 shrink-0" aria-hidden>
                  <span className="absolute inset-x-0 top-1/2 h-px bg-current" />
                  <span className={clsx("absolute inset-y-0 left-1/2 w-px bg-current transition-transform duration-300", isOpen && "scale-y-0")} />
                </span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className={clsx("max-w-3xl pb-7 body-lg", tone === "light" ? "text-ink/70" : "text-white/65")}>{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
            {!isOpen && <p className="sr-only">{f.a}</p>}
          </li>
        );
      })}
    </ul>
  );
}

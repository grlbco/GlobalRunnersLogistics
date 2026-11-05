"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { clsx } from "clsx";

const SPRING = { type: "spring", stiffness: 520, damping: 40 } as const;

/** Pill tabs that are plain links. The black pill slides to the active tab. */
export function LinkTabs({ items, active }: { items: { key: string; label: ReactNode; href: string }[]; active: string }) {
  const id = useId();
  return (
    <div className="inline-flex items-center gap-0.5 rounded-[14px] border border-line bg-surface p-1">
      {items.map((t) => {
        const on = t.key === active;
        return (
          <Link key={t.key} href={t.href} aria-current={on ? "page" : undefined} className={clsx("relative rounded-[10px] px-3.5 py-1.5 text-[0.84rem] font-medium transition-colors duration-150", on ? "text-surface" : "text-muted hover:text-fg")}>
            {on && <motion.span layoutId={`tab-${id}`} className="absolute inset-0 rounded-[10px] bg-fg" transition={SPRING} />}
            <span className="relative">{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

"use client";

import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

/** House easing, same curve as the website. */
export const EASE = [0.22, 1, 0.36, 1] as const;

/** Content rises in once. Used for page bodies and cards. */
export function FadeIn({ children, delay = 0, y = 8, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(delay, 0.2), ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Children appear one after another (lists, card grids). */
export function Stagger({ children, className, gap = 0.035, as = "div" }: { children: ReactNode; className?: string; gap?: number; as?: "div" | "ul" }) {
  const reduce = useReducedMotion();
  const Comp = as === "ul" ? motion.ul : motion.div;
  return (
    <Comp
      className={className}
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </Comp>
  );
}

export function StaggerItem({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "li" }) {
  const Comp = as === "li" ? motion.li : motion.div;
  return (
    <Comp
      className={className}
      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } } }}
    >
      {children}
    </Comp>
  );
}

const fmt = (v: number, decimals: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Number that counts up when it scrolls into view. */
export function CountUp({ value, decimals = 0, prefix = "", suffix = "", duration = 0.7 }: { value: number; decimals?: number; prefix?: string; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) => `${prefix}${fmt(v, decimals)}${suffix}`);
  useEffect(() => {
    if (!inView) return;
    if (reduce) return void mv.set(value);
    const c = animate(mv, value, { duration, ease: EASE });
    return () => c.stop();
  }, [inView, value, reduce, duration, mv]);
  return <motion.span ref={ref} className="tabular-nums">{text}</motion.span>;
}

/** Horizontal bar that grows from the left when in view. */
export function GrowBar({ pct, className, delay = 0 }: { pct: number; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  return (
    <div ref={ref} className="h-full w-full">
      <motion.div
        className={className}
        style={{ originX: 0, height: "100%", width: `${Math.max(0, Math.min(100, pct))}%` }}
        initial={reduce ? false : { scaleX: 0 }}
        animate={inView ? { scaleX: 1 } : undefined}
        transition={{ duration: 0.6, delay, ease: EASE }}
      />
    </div>
  );
}

/** Small live indicator (a pulsing dot), e.g. "sending on". */
export function LiveDot({ on = true }: { on?: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className={on ? "h-2 w-2 rounded-full bg-emerald-500" : "h-2 w-2 rounded-full bg-ghost"} style={on ? { animation: "pulse-dot 2s ease-in-out infinite" } : undefined} />
    </span>
  );
}

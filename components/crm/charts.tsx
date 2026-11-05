"use client";

import Link from "next/link";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { EASE, GrowBar } from "./motion";

import { CHART } from "@/lib/crm/chart-colors";
export { CHART };

// ─── geometry ───────────────────────────────────────────────────────────────

type Pt = [number, number];

/** Monotone cubic (no overshoot): smooth lines that never dip below zero between points. */
function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const n = pts.length;
  const dx: number[] = [], m: number[] = [], t: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1);
  }
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${pts[i][0] + h},${pts[i][1] + h * t[i]} ${pts[i + 1][0] - h},${pts[i + 1][1] - h * t[i + 1]} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

/** Top of the y-axis: 4 equal, round steps (1, 2, 5, 10, 20, 25, 50…) that cover v. */
function niceMax(v: number) {
  const raw = Math.max(1, v) / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  return Math.max(4, Math.ceil(step) * 4);
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

// ─── area / line chart ──────────────────────────────────────────────────────

export type Series = { key: string; label: string; color: string; values: number[]; dashed?: boolean; area?: boolean };

/** Trend chart: lines draw in, areas fade up, hover scrubs a crosshair with every value at that day. */
export function AreaChart({ labels, series, height = 240, format = (v: number) => v.toLocaleString("en-US") }: { labels: string[]; series: Series[]; height?: number; format?: (v: number) => string }) {
  const [wrap, width] = useWidth<HTMLDivElement>();
  const inView = useInView(wrap, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 34, r: 8, t: 10, b: 24 };
  const W = Math.max(width, 200), H = height;
  const n = labels.length;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(W / 90))));

  const paths = useMemo(() => series.map((s) => {
    const pts = s.values.map((v, i) => [x(i), y(v)] as Pt);
    const line = smoothPath(pts);
    const area = pts.length ? `${line}L${x(pts.length - 1)},${y(0)}L${x(0)},${y(0)}Z` : "";
    return { ...s, line, area };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [series, W, H, max]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div ref={wrap} className="relative w-full select-none" style={{ height: H }}>
      {width > 0 && (
        <svg width={W} height={H} className="overflow-visible" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`g-${uid}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.16} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={CHART.grid} strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-faint text-[10px] tabular-nums">{t >= 1000 ? `${Math.round(t / 100) / 10}k` : Math.round(t)}</text>
            </g>
          ))}
          {labels.map((l, i) => (i % every === 0 || i === n - 1) && (
            <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-faint text-[10px]">{l}</text>
          ))}
          {paths.map((p, si) => (series[si].area ?? true) && p.area !== "" && (
            <motion.path key={`a-${p.key}`} d={p.area} fill={`url(#g-${uid}-${p.key})`}
              initial={reduce ? false : { opacity: 0 }} animate={inView ? { opacity: 1 } : undefined} transition={{ duration: 0.9, delay: 0.35 + si * 0.1, ease: EASE }} />
          ))}
          {paths.map((p, si) => (
            <motion.path key={`l-${p.key}`} d={p.line} fill="none" stroke={p.color} strokeWidth={p.dashed ? 1.5 : 2} strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={p.dashed ? "4 4" : undefined}
              initial={reduce || p.dashed ? { opacity: 0 } : { pathLength: 0 }} animate={inView ? (reduce || p.dashed ? { opacity: 1 } : { pathLength: 1 }) : undefined}
              transition={{ duration: 1.2, delay: si * 0.12, ease: EASE }} />
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke={CHART.navy} strokeOpacity={0.18} />
              {series.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={3.5} fill="#fff" stroke={s.color} strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
      )}
      <AnimatePresence>
        {hover !== null && width > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-[10px] border border-line bg-surface/95 px-3 py-2 text-xs shadow-pop backdrop-blur"
            style={{ left: Math.min(Math.max(x(hover) + 12, 0), W - 160) }}
          >
            <p className="mb-1.5 font-medium text-fg">{labels[hover]}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-4 py-0.5 text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
                <span className="font-medium text-fg tabular-nums">{format(s.values[hover] ?? 0)}</span>
              </p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Legend({ series }: { series: Pick<Series, "key" | "label" | "color" | "dashed">[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.78rem] text-muted">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className={clsx("h-[3px] w-3.5 rounded-full", s.dashed && "opacity-60")} style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

// ─── sparkline ──────────────────────────────────────────────────────────────

/** Tiny trend line for KPI cards. Draws in; the last point gets a dot. */
export function Sparkline({ values, color = CHART.navy, height = 36, className }: { values: number[]; color?: string; height?: number; className?: string }) {
  const [wrap, width] = useWidth<HTMLDivElement>();
  const inView = useInView(wrap, { once: true });
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const W = Math.max(width, 40), H = height;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [values.length <= 1 ? W : (i / (values.length - 1)) * (W - 4) + 2, 3 + (1 - v / max) * (H - 6)] as Pt);
  const line = smoothPath(pts);
  const last = pts[pts.length - 1];
  return (
    <div ref={wrap} className={clsx("w-full", className)} style={{ height: H }}>
      {width > 0 && values.length > 1 && (
        <svg width={W} height={H} className="overflow-visible">
          <defs>
            <linearGradient id={`s-${uid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.14} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <motion.path d={`${line}L${last[0]},${H}L${pts[0][0]},${H}Z`} fill={`url(#s-${uid})`}
            initial={reduce ? false : { opacity: 0 }} animate={inView ? { opacity: 1 } : undefined} transition={{ duration: 0.8, delay: 0.4 }} />
          <motion.path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }} animate={inView ? { pathLength: 1 } : undefined} transition={{ duration: 1.1, ease: EASE }} />
          <motion.circle cx={last[0]} cy={last[1]} r={2.75} fill={color}
            initial={reduce ? false : { scale: 0 }} animate={inView ? { scale: 1 } : undefined} transition={{ delay: 1.05, type: "spring", stiffness: 400, damping: 18 }} />
        </svg>
      )}
    </div>
  );
}

// ─── grouped columns ────────────────────────────────────────────────────────

/** Grouped columns with rounded tops. They rise in a wave, and hover shows the exact values. */
export function BarChart({ groups, seriesNames, height = 232 }: { groups: { label: string; values: number[] }[]; seriesNames: string[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...groups.flatMap((g) => g.values)));
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  const fills = ["bg-fg", "bg-line-strong"];
  const fmtTick = (t: number) => (t >= 1000 ? `${Math.round(t / 100) / 10}k` : String(Math.round(t)));
  // Only some date labels fit when there are many groups.
  const every = groups.length > 8 ? Math.ceil(groups.length / 6) : 1;

  return (
    <div ref={ref} className="relative select-none pl-8" style={{ height }}>
      {ticks.map((t) => (
        <div key={t} className="absolute inset-x-0 flex items-center" style={{ top: `calc((100% - 26px) * ${1 - t})` }}>
          <span className="w-8 shrink-0 -translate-y-1/2 text-[0.7rem] tabular-nums text-faint">{fmtTick(t * max)}</span>
          <span className="h-px flex-1 -translate-y-1/2 bg-line" />
        </div>
      ))}
      <div className="absolute inset-y-0 left-8 right-0 flex">
        {groups.map((g, i) => (
          <div key={g.label + i} className="relative flex min-w-0 flex-1 flex-col" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <div className="flex flex-1 items-end justify-center gap-[3px] pb-[26px]">
              {g.values.map((v, si) => (
                <motion.div
                  key={si}
                  className={clsx("w-[34%] max-w-6 rounded-t-[6px] transition-opacity duration-150", fills[si % fills.length], hover !== null && hover !== i && "opacity-40")}
                  style={{ height: `${v ? Math.max(2, (v / max) * 100) : 0}%`, originY: 1 }}
                  initial={reduce ? false : { scaleY: 0 }}
                  animate={inView ? { scaleY: 1 } : undefined}
                  transition={{ duration: 0.5, delay: i * 0.035 + si * 0.02, ease: EASE }}
                />
              ))}
            </div>
            {i % every === 0 && <span className="absolute inset-x-[-1rem] bottom-0 truncate text-center text-[0.7rem] text-faint">{g.label.split("–")[0]}</span>}
            <AnimatePresence>
              {hover === i && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
                  className={clsx("pointer-events-none absolute top-0 z-10 min-w-40 rounded-[11px] border border-line bg-surface px-3 py-2 text-xs shadow-pop", i > groups.length / 2 ? "right-1/2" : "left-1/2")}
                >
                  <p className="mb-1 font-medium text-fg">{g.label}</p>
                  {g.values.map((v, si) => (
                    <p key={si} className="flex items-center justify-between gap-4 py-0.5 text-muted">
                      <span className="flex items-center gap-1.5"><span className={clsx("h-2 w-2 rounded-[2px]", fills[si % fills.length])} />{seriesNames[si]}</span>
                      <span className="font-medium tabular-nums text-fg">{v.toLocaleString("en-US")}</span>
                    </p>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── bars ───────────────────────────────────────────────────────────────────

export type BarItem = { label: string; value: number; href?: string; hint?: string; tag?: string };

/** Ranked horizontal bars (Stripe-style): label inside the bar track, value on the right. */
export function BarList({ items, color = "bg-hover", accentFirst, format = (v: number) => v.toLocaleString("en-US") }: { items: BarItem[]; color?: string; accentFirst?: boolean; format?: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => {
        const inner = (
          <div className="group relative flex h-8 items-center justify-between gap-3 rounded-[6px] px-2.5 transition-colors hover:bg-subtle">
            <div className="absolute inset-y-0 left-0 right-16 overflow-hidden rounded-[6px]">
              <GrowBar pct={(it.value / max) * 100} delay={i * 0.06} className={clsx("rounded-[6px]", accentFirst && i === 0 ? "bg-line-strong" : color)} />
            </div>
            <span className="relative z-[1] flex min-w-0 items-center gap-2 truncate text-[0.84rem] text-fg-2">
              {it.tag && <span className="font-mono text-[0.7rem] text-faint">{it.tag}</span>}
              <span className="truncate">{it.label}</span>
              {it.hint && <span className="hidden truncate text-faint sm:inline">· {it.hint}</span>}
            </span>
            <span className="relative z-[1] w-14 shrink-0 text-right text-[0.84rem] font-medium tabular-nums text-fg">{format(it.value)}</span>
          </div>
        );
        return <li key={it.label + i}>{it.href ? <Link href={it.href}>{inner}</Link> : inner}</li>;
      })}
    </ul>
  );
}

/** Funnel: each step's bar relative to the first, with the step-to-step conversion on the right. */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="space-y-3.5">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].value : 0;
        const conv = i && prev ? Math.round((s.value / prev) * 1000) / 10 : null;
        const last = i === steps.length - 1;
        return (
          <li key={s.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-[0.82rem] text-fg-2">{s.label}</span>
              <span className="flex items-baseline gap-2">
                {i > 0 && <span className="text-[0.7rem] tabular-nums text-faint">{conv === null ? "—" : `${conv}%`}</span>}
                <span className="text-[0.875rem] font-semibold tabular-nums text-fg">{s.value.toLocaleString("en-US")}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-hover">
              <GrowBar pct={s.value ? Math.max(2, (s.value / top) * 100) : 0} delay={i * 0.08} className={clsx("rounded-full", last ? "bg-fg" : i === 0 ? "bg-fg" : "bg-fg/70")} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Thin segmented meter (e.g. how the assistant's runs ended). */
export function Meter({ parts }: { parts: { label: string; value: number; className: string }[] }) {
  const total = Math.max(1, parts.reduce((s, p) => s + p.value, 0));
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  return (
    <div>
      <div ref={ref} className="flex h-2 overflow-hidden rounded-full bg-hover">
        {parts.map((p, i) => (
          <motion.div key={p.label} className={p.className} initial={{ width: 0 }} animate={inView ? { width: `${(p.value / total) * 100}%` } : undefined}
            transition={{ duration: 0.9, delay: i * 0.08, ease: EASE }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.78rem] text-muted">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5"><span className={clsx("h-2 w-2 rounded-full", p.className)} />{p.label} <span className="font-medium text-fg tabular-nums">{p.value.toLocaleString("en-US")}</span></span>
        ))}
      </div>
    </div>
  );
}

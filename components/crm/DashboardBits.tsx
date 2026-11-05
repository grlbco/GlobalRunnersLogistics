"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { BarChart, Sparkline } from "./charts";
import { CHART } from "@/lib/crm/chart-colors";
import { CountUp, GrowBar } from "./motion";
import { ArrowTile, Card, selectCls } from "./ui";
import type { Daily } from "@/lib/crm/daily";

export type { Daily };

const short = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** KPI card: label, corner arrow, big number, then a colored change chip with what it's compared to. */
export function Kpi({ label, value, hint, href, spark, color = CHART.navy, delta, decimals = 0 }: {
  label: string; value: number; hint?: string; href?: string; spark?: number[]; color?: string; delta?: { diff: number; label: string }; decimals?: number;
}) {
  const up = (delta?.diff ?? 0) > 0, down = (delta?.diff ?? 0) < 0;
  return (
    <Card className="relative h-full overflow-hidden p-5">
      <div className="flex min-h-9 items-start justify-between gap-3">
        <p className="text-[0.875rem] text-muted">{label}</p>
        {href && <ArrowTile href={href} label={`Open ${label}`} />}
      </div>
      <p className="mt-2 text-[2.25rem] font-semibold leading-none tracking-[-0.04em] text-fg"><CountUp value={value} decimals={decimals} /></p>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] text-muted">
        {delta && (
          <span className={clsx("rounded-[6px] px-1.5 py-0.5 text-[0.75rem] font-medium tabular-nums", up ? "bg-emerald-50 text-emerald-700" : down ? "bg-red-50 text-red-700" : "bg-hover text-faint")}>
            {up ? "+" : down ? "−" : ""}{Math.abs(delta.diff).toLocaleString("en-US")}
          </span>
        )}
        <span>{delta?.label ?? hint}</span>
      </p>
      {spark && spark.length > 1 && <Sparkline values={spark} color={color} className="mt-3" />}
    </Card>
  );
}

const RANGES = [
  { days: 7, step: 1, label: "7 days" },
  { days: 14, step: 2, label: "14 days" },
  { days: 30, step: 5, label: "30 days" },
] as const;

/** Black and grey bars: driver replies against our answers, grouped so there are never too many to read. */
export function ActivityChart({ days, selectable = false, height = 232 }: { days: Daily[]; selectable?: boolean; height?: number }) {
  const [range, setRange] = useState(30);
  const slice = selectable ? days.slice(-range) : days;
  const step = selectable ? RANGES.find((r) => r.days === range)!.step : Math.max(1, Math.ceil(days.length / 10));
  const groups = useMemo(() => {
    const out: { label: string; values: number[] }[] = [];
    // group from the newest day back, so the last bar is always complete and ends today
    for (let end = slice.length; end > 0; end -= step) {
      const part = slice.slice(Math.max(0, end - step), end);
      const span = part.length > 1 ? `${short(part[0].day)}–${short(part[part.length - 1].day)}` : part[0] ? short(part[0].day) : "";
      out.unshift({ label: span, values: [part.reduce((s, d) => s + d.replies, 0), part.reduce((s, d) => s + d.answered, 0)] });
    }
    return out;
  }, [slice, step]);
  const replies = slice.reduce((s, d) => s + d.replies, 0);
  const answers = slice.reduce((s, d) => s + d.answered, 0);
  const applied = slice.reduce((s, d) => s + d.applied, 0);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8rem] text-muted">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-fg" />Driver replies</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-line-strong" />Our answers</span>
        </div>
        {selectable && (
          <select aria-label="Time range" value={range} onChange={(e) => setRange(Number(e.target.value))} className={clsx(selectCls, "!h-9 !w-auto !rounded-[11px] !pl-3 text-[0.8rem]")}>
            {RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
          </select>
        )}
      </div>
      <div className="mt-4"><BarChart groups={groups} seriesNames={["Driver replies", "Our answers"]} height={height} /></div>
      <p className="mt-4 text-[0.875rem] text-fg">{replies.toLocaleString("en-US")} replies, {answers.toLocaleString("en-US")} answers</p>
      <p className="mt-0.5 text-[0.8rem] text-muted">{applied.toLocaleString("en-US")} {applied === 1 ? "application" : "applications"} in the last {slice.length} days, Las Vegas time</p>
    </div>
  );
}

/** Pipeline steps side by side: name, count, and a bar that gets lighter down the funnel. */
export function FunnelStrip({ steps }: { steps: { label: string; value: number; href?: string }[] }) {
  const top = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
      {steps.map((s, i) => {
        const inner = (
          <>
            <span className="block truncate text-[0.8rem] text-muted">{s.label}</span>
            <span className="mt-1 block text-[1rem] font-medium tabular-nums text-fg">{s.value.toLocaleString("en-US")}</span>
            <span className="mt-2 block h-[18px] overflow-hidden rounded-[6px] bg-hover">
              <GrowBar pct={s.value ? Math.max(3, (s.value / top) * 100) : 0} delay={i * 0.05} className="rounded-[6px] bg-fg" />
            </span>
          </>
        );
        return <li key={s.label} style={{ opacity: 1 - i * 0.07 }}>{s.href ? <Link href={s.href} className="block rounded-[8px] transition-opacity hover:opacity-70">{inner}</Link> : inner}</li>;
      })}
    </ol>
  );
}

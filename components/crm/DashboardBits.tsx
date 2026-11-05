"use client";

import { clsx } from "clsx";
import { AreaChart, Sparkline } from "./charts";
import { CHART } from "@/lib/crm/chart-colors";
import { CountUp } from "./motion";
import { Card } from "./ui";
import type { Daily } from "@/lib/crm/daily";

const short = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export type { Daily };

export function Kpi({ label, value, hint, spark, color = CHART.navy, delta, decimals = 0 }: {
  label: string; value: number; hint?: string; spark?: number[]; color?: string; delta?: { diff: number; label: string }; decimals?: number;
}) {
  const up = (delta?.diff ?? 0) > 0, down = (delta?.diff ?? 0) < 0;
  return (
    <Card className="group relative overflow-hidden p-5 transition-shadow duration-300 hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.8rem] font-medium text-muted">{label}</p>
        {delta && (
          <span className={clsx("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.7rem] font-medium tabular-nums",
            up ? "bg-emerald-50 text-emerald-700" : down ? "bg-red-50 text-red-700" : "bg-hover text-faint")}>
            {up ? "↑" : down ? "↓" : "·"} {Math.abs(delta.diff).toLocaleString("en-US")}
          </span>
        )}
      </div>
      <p className="mt-2 text-[1.85rem] font-semibold leading-none tracking-[-0.035em] text-fg"><CountUp value={value} decimals={decimals} /></p>
      <p className="mt-1.5 text-[0.75rem] text-faint">{delta ? `${delta.label} · ` : ""}{hint}</p>
      {spark && spark.length > 1 && <Sparkline values={spark} color={color} className="mt-3" />}
    </Card>
  );
}

const SERIES = [
  { key: "replies", label: "Driver replies", color: CHART.signal },
  { key: "answered", label: "Our answers", color: CHART.navy },
  { key: "applied", label: "Applications", color: CHART.dusk, dashed: true },
] as const;

export function ActivityChart({ days }: { days: Daily[] }) {
  const series = SERIES.map((s) => ({ ...s, values: days.map((d) => d[s.key]), area: s.key !== "applied" }));
  const total = (k: keyof Daily) => days.reduce((s, d) => s + Number(d[k]), 0);
  return (
    <div>
      <div className="mb-4">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {SERIES.map((s) => (
            <div key={s.key}>
              <p className="flex items-center gap-1.5 text-[0.75rem] text-muted"><span className={s.key === "applied" ? "h-[3px] w-3 rounded-full" : "h-2 w-2 rounded-full"} style={{ background: s.color }} />{s.label}</p>
              <p className="mt-0.5 text-[1.15rem] font-semibold tracking-[-0.02em] tabular-nums"><CountUp value={total(s.key)} /></p>
            </div>
          ))}
        </div>
      </div>
      <AreaChart labels={days.map((d) => short(d.day))} series={series} height={230} />
    </div>
  );
}

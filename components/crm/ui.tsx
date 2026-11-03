import { clsx } from "clsx";
import type { ReactNode } from "react";
import { stageLabel, stageTone, toneClass } from "@/lib/crm/stages";

export function PageHead({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.07] px-5 py-6 md:px-8">
      <div>
        <h1 className="text-[1.6rem] font-semibold tracking-[-0.03em]">{title}</h1>
        {sub && <p className="mt-1 text-sm text-white/50">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-[6px] border border-white/[0.08] bg-white/[0.02]", className)}>{children}</div>;
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("font-mono text-[0.68rem] uppercase tracking-[0.14em] text-white/40", className)}>{children}</p>;
}

export function StageBadge({ stage }: { stage: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[0.72rem] font-medium", toneClass[stageTone(stage)])}>
      {stageLabel(stage)}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="p-5">
      <Label>{label}</Label>
      <p className="mt-3 text-[2rem] font-semibold leading-none tracking-[-0.03em] tabular-nums">{value}</p>
      {hint && <p className="mt-2 text-xs text-white/45">{hint}</p>}
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-[6px] bg-white/[0.04]", className)} />;
}

export const inputCls =
  "h-10 w-full rounded-[4px] border border-white/12 bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/35 focus:border-white/40 focus:outline-none";
export const btnCls =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[4px] bg-signal px-4 text-sm font-medium text-white transition-colors hover:bg-signal-ink disabled:opacity-50";
export const btnGhostCls =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[4px] border border-white/15 px-4 text-sm text-white/80 transition-colors hover:border-white/40 hover:text-white";

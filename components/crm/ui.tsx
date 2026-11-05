import Link from "next/link";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { stageLabel, stageTone, toneClass } from "@/lib/crm/stages";

export { LinkTabs } from "./LinkTabs";

/** Command design system: grey canvas, white cards, near-black controls, Geist, color only where it means something. */

export function PageHead({ title, sub, greeting, right, crumbs }: { title: string; sub?: ReactNode; greeting?: ReactNode; right?: ReactNode; crumbs?: { href: string; label: string }[] }) {
  return (
    <header className="px-5 pb-4 pt-2 md:px-6">
      {crumbs && crumbs.length > 0 && (
        <nav className="mb-2 flex items-center gap-1.5 text-[0.8rem] text-faint">
          {crumbs.map((c) => (
            <span key={c.href} className="flex items-center gap-1.5">
              <Link href={c.href} className="transition-colors hover:text-fg">{c.label}</Link>
              <span aria-hidden>/</span>
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {greeting && <p className="mb-1 text-[0.875rem] text-muted">{greeting}</p>}
          <h1 className="text-[1.5rem] font-medium leading-tight tracking-[-0.025em] text-fg">{title}</h1>
          {sub && <p className="mt-1 max-w-2xl text-[0.875rem] leading-relaxed text-muted">{sub}</p>}
        </div>
        {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
      </div>
    </header>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-[16px] border border-line bg-surface shadow-card", className)}>{children}</div>;
}

/** Card with a title row (title left, actions right). No divider: spacing does the separating. */
export function Panel({ title, sub, right, children, className, bodyClass }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
        <div className="min-w-0">
          <h2 className="truncate text-[0.95rem] font-medium tracking-[-0.01em] text-fg">{title}</h2>
          {sub && <p className="mt-0.5 truncate text-[0.78rem] text-faint">{sub}</p>}
        </div>
        {right}
      </div>
      <div className={clsx("px-5 pb-5 pt-3", bodyClass)}>{children}</div>
    </Card>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("text-[0.8rem] font-medium text-muted", className)}>{children}</p>;
}

const TAG = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[7px] border border-current/10 px-1.5 py-[3px] text-[0.72rem] font-medium leading-none";

export function StageBadge({ stage }: { stage: string }) {
  return <span className={clsx(TAG, toneClass[stageTone(stage)])}>{stageLabel(stage)}</span>;
}

export type BadgeTone = "neutral" | "good" | "warn" | "bad" | "accent" | "info";
const BADGE: Record<BadgeTone, string> = {
  neutral: "bg-hover text-muted",
  good: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-800",
  bad: "bg-red-50 text-red-700",
  accent: "bg-signal-soft text-signal-ink",
  info: "bg-hover text-fg-2",
};
const BADGE_DOT: Record<BadgeTone, string> = {
  neutral: "bg-faint", good: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-red-500", accent: "bg-signal", info: "bg-fg",
};
export function Badge({ tone = "neutral", dot, children, className }: { tone?: BadgeTone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={clsx(TAG, BADGE[tone], className)}>
      {dot && <span className={clsx("h-1.5 w-1.5 rounded-full", BADGE_DOT[tone])} />}
      {children}
    </span>
  );
}

/** Square outlined arrow in the corner of a KPI card. */
export function ArrowTile({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} className="group/arrow flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-line text-fg transition-colors duration-150 hover:border-line-strong hover:bg-hover">
      <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-200 ease-out group-hover/arrow:-translate-y-px group-hover/arrow:translate-x-px" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7 17 17 7M9 7h8v8" /></svg>
    </Link>
  );
}

export function Stat({ label, value, hint, children, className }: { label: string; value: ReactNode; hint?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <Card className={clsx("relative overflow-hidden p-5", className)}>
      <p className="text-[0.875rem] text-muted">{label}</p>
      <p className="mt-3 text-[2rem] font-semibold leading-none tracking-[-0.035em] text-fg tabular-nums">{value}</p>
      {hint && <p className="mt-3 text-[0.78rem] text-faint">{hint}</p>}
      {children}
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx("rounded-[16px] bg-hover", className)}
      style={{ backgroundImage: "linear-gradient(90deg, transparent, color-mix(in oklab, var(--color-surface) 70%, transparent), transparent)", backgroundSize: "400px 100%", backgroundRepeat: "no-repeat", animation: "shimmer 1.4s ease-in-out infinite" }}
    />
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="text-sm font-medium text-fg">{title}</p>
      {children && <p className="mt-1 max-w-sm text-[0.84rem] leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "·";
  return <span className={clsx("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-hover text-[0.72rem] font-semibold text-fg-2", className)}>{initials}</span>;
}

export const inputCls =
  "h-10 w-full rounded-[12px] border border-line-strong bg-surface px-3 text-[0.875rem] text-fg placeholder:text-faint transition-[border-color,box-shadow] duration-150 hover:border-faint focus:border-fg focus:shadow-[0_0_0_3px_var(--color-hover)] focus:outline-none disabled:bg-subtle disabled:text-faint";
export const selectCls = `${inputCls} appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23676c74' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>")] bg-[length:12px] bg-[right_10px_center] bg-no-repeat pr-8`;
export const textareaCls = inputCls.replace("h-10", "min-h-24 py-2 leading-relaxed");
/** Primary: near-black (inverts in dark mode). */
export const btnCls =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-fg px-4 text-[0.875rem] font-medium text-surface transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40";
/** The one action that matters on a screen (launch, send). Same weight as primary: the template has a single primary color. */
export const btnAccentCls = btnCls;
export const btnGhostCls =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-line-strong bg-surface px-4 text-[0.875rem] font-medium text-fg transition-[background-color,border-color,transform] duration-150 hover:bg-hover active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40";
export const btnDangerCls =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-red-200 bg-surface px-4 text-[0.875rem] font-medium text-red-700 transition-[background-color,transform] duration-150 hover:bg-red-50 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40";

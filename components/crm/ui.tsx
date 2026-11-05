import Link from "next/link";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { stageLabel, stageTone, toneClass, toneDot } from "@/lib/crm/stages";

/** Command light design system. Brand ink text, hairline borders, one accent (signal), quiet motion. */

export function PageHead({ title, sub, right, crumbs }: { title: string; sub?: ReactNode; right?: ReactNode; crumbs?: { href: string; label: string }[] }) {
  return (
    <header className="border-b border-line px-5 pb-5 pt-6 md:px-8 md:pt-7">
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
          <h1 className="text-[1.375rem] font-semibold leading-tight tracking-[-0.025em] text-fg">{title}</h1>
          {sub && <p className="mt-1 max-w-2xl text-[0.875rem] leading-relaxed text-muted">{sub}</p>}
        </div>
        {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
      </div>
    </header>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-[10px] border border-line bg-surface shadow-card", className)}>{children}</div>;
}

/** Card with a title row (title left, actions right) and a hairline under it. */
export function Panel({ title, sub, right, children, className, bodyClass }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="truncate text-[0.875rem] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
          {sub && <p className="mt-0.5 truncate text-[0.78rem] text-faint">{sub}</p>}
        </div>
        {right}
      </div>
      <div className={clsx("p-5", bodyClass)}>{children}</div>
    </Card>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("font-mono text-[0.66rem] uppercase tracking-[0.12em] text-faint", className)}>{children}</p>;
}

export function StageBadge({ stage }: { stage: string }) {
  const tone = stageTone(stage);
  return (
    <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-[3px] text-[0.72rem] font-medium leading-none", toneClass[tone])}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", toneDot[tone])} />
      {stageLabel(stage)}
    </span>
  );
}

export type BadgeTone = "neutral" | "good" | "warn" | "bad" | "accent" | "info";
const BADGE: Record<BadgeTone, string> = {
  neutral: "bg-hover text-muted",
  good: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-800",
  bad: "bg-red-50 text-red-700",
  accent: "bg-signal-soft text-signal-ink",
  info: "bg-navy-soft text-navy",
};
const BADGE_DOT: Record<BadgeTone, string> = {
  neutral: "bg-faint", good: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-red-500", accent: "bg-signal", info: "bg-navy",
};
export function Badge({ tone = "neutral", dot, children, className }: { tone?: BadgeTone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-[3px] text-[0.72rem] font-medium leading-none", BADGE[tone], className)}>
      {dot && <span className={clsx("h-1.5 w-1.5 rounded-full", BADGE_DOT[tone])} />}
      {children}
    </span>
  );
}

export function Stat({ label, value, hint, children, className }: { label: string; value: ReactNode; hint?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <Card className={clsx("group relative overflow-hidden p-5 transition-shadow duration-300 hover:shadow-pop", className)}>
      <p className="text-[0.8rem] font-medium text-muted">{label}</p>
      <p className="mt-2 text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-fg tabular-nums">{value}</p>
      {hint && <p className="mt-2 text-[0.78rem] text-faint">{hint}</p>}
      {children}
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx("rounded-[10px] bg-hover", className)}
      style={{ backgroundImage: "linear-gradient(90deg, transparent, rgb(255 255 255 / 0.7), transparent)", backgroundSize: "400px 100%", backgroundRepeat: "no-repeat", animation: "shimmer 1.4s ease-in-out infinite" }}
    />
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-line-strong bg-subtle px-6 py-12 text-center">
      <div className="bg-dots mb-4 h-10 w-10 rounded-full border border-line bg-surface" />
      <p className="text-sm font-medium text-fg">{title}</p>
      {children && <p className="mt-1 max-w-sm text-[0.84rem] leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Pill tabs that are plain links (server-friendly). */
export function LinkTabs({ items, active }: { items: { key: string; label: ReactNode; href: string }[]; active: string }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-[8px] border border-line bg-subtle p-0.5">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={clsx(
            "rounded-[6px] px-3 py-1.5 text-[0.8rem] font-medium transition-all duration-200",
            t.key === active ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "·";
  // stable soft color from the name, within the brand family
  const hues = ["bg-navy-soft text-navy", "bg-signal-soft text-signal-ink", "bg-[#fdf3e7] text-[#8a4f0e]", "bg-emerald-50 text-emerald-800", "bg-[#eef0fb] text-[#3b4aa0]", "bg-[#f3eef9] text-[#6b3fa0]"];
  const h = [...name].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7) % hues.length;
  return <span className={clsx("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold", hues[h], className)}>{initials}</span>;
}

export const inputCls =
  "h-9 w-full rounded-[7px] border border-line bg-surface px-3 text-[0.875rem] text-fg shadow-[0_1px_1px_rgb(10_18_32/0.03)] placeholder:text-faint transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus:border-fg/30 focus:shadow-[0_0_0_3px_rgb(10_18_32/0.06)] focus:outline-none disabled:bg-subtle disabled:text-faint";
export const selectCls = `${inputCls} appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235f6b7d' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>")] bg-[length:12px] bg-[right_10px_center] bg-no-repeat pr-8`;
export const textareaCls = inputCls.replace("h-9", "min-h-24 py-2 leading-relaxed");
/** Primary: brand ink. */
export const btnCls =
  "inline-flex h-9 items-center justify-center gap-2 rounded-[7px] bg-fg px-3.5 text-[0.84rem] font-medium text-white shadow-[0_1px_2px_rgb(10_18_32/0.15),inset_0_1px_0_rgb(255_255_255/0.08)] transition-all duration-150 hover:bg-navy active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";
/** Accent: brand signal, for the one action that matters on a screen (launch, send). */
export const btnAccentCls =
  "inline-flex h-9 items-center justify-center gap-2 rounded-[7px] bg-signal px-3.5 text-[0.84rem] font-medium text-white shadow-[0_1px_2px_rgb(179_46_16/0.3),inset_0_1px_0_rgb(255_255_255/0.15)] transition-all duration-150 hover:bg-signal-ink active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";
export const btnGhostCls =
  "inline-flex h-9 items-center justify-center gap-2 rounded-[7px] border border-line bg-surface px-3.5 text-[0.84rem] font-medium text-fg-2 shadow-[0_1px_1px_rgb(10_18_32/0.03)] transition-all duration-150 hover:border-line-strong hover:bg-subtle hover:text-fg active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";
export const btnDangerCls =
  "inline-flex h-9 items-center justify-center gap-2 rounded-[7px] border border-red-200 bg-surface px-3.5 text-[0.84rem] font-medium text-red-700 transition-all duration-150 hover:bg-red-50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";

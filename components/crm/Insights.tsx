import Link from "next/link";
import { clsx } from "clsx";

export type Insight = { title: string; detail: string; action?: { label: string; href: string }; tone: "bad" | "warn" | "good" | "quiet"; icon: string };

const TONE: Record<Insight["tone"], { tile: string; link: string }> = {
  bad: { tile: "border-red-200 bg-red-50 text-red-600", link: "text-red-600" },
  warn: { tile: "border-amber-200 bg-amber-50 text-amber-700", link: "text-amber-700" },
  good: { tile: "border-emerald-200 bg-emerald-50 text-emerald-700", link: "text-emerald-700" },
  quiet: { tile: "border-line bg-hover text-faint", link: "text-muted" },
};

export const ICONS = {
  alert: "M12 4 3 20h18zM12 10v4M12 17h.01",
  inbox: "M4 13h4l1.5 3h5L16 13h4M4 13l2.5-8h11L20 13v6H4z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  edit: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
  form: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5",
  check: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6",
};

/** The "what needs you" column: tinted tile, what happened, one link to deal with it. */
export function Insights({ items }: { items: Insight[] }) {
  return (
    <ul className="space-y-5">
      {items.map((it) => {
        const t = TONE[it.tone];
        return (
          <li key={it.title} className="flex gap-3.5">
            <span className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border", t.tile)}>
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={it.icon} /></svg>
            </span>
            <span className="min-w-0">
              <span className="block text-[0.9rem] font-medium leading-snug text-fg">{it.title}</span>
              <span className="mt-0.5 block text-[0.8rem] leading-snug text-muted">{it.detail}</span>
              {it.action && <Link href={it.action.href} className={clsx("mt-1.5 inline-block text-[0.8rem] font-medium underline-offset-4 hover:underline", t.link)}>{it.action.label}</Link>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

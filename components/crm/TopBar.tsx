"use client";

import Link from "next/link";
import Form from "next/form";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { clsx } from "clsx";
import { Avatar } from "./ui";
import { BrandTile } from "./BrandTile";

export type TopBarProps = {
  me: { name: string };
  team: { names: string[]; total: number; href: string | null };
  unread: number | null;
  canSearch: boolean;
};

const GROUP = "flex items-center gap-1 rounded-[17px] border-[3px] border-line bg-subtle p-[3px]";
const TILE = "relative flex h-10 w-10 items-center justify-center rounded-[12px] bg-surface text-fg-2 transition-colors duration-150 hover:text-fg";

const subscribe = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
};

function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === "dark", () => false);
  const set = (next: "light" | "dark") => {
    const apply = () => {
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("crm-theme", next); } catch { /* private mode: the choice just isn't remembered */ }
    };
    // The crossfade is only decoration: a hidden tab rejects it, and that must not surface as an error.
    if ("startViewTransition" in document && document.visibilityState === "visible" && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = document.startViewTransition(apply);
      t.ready.catch(() => {});
      t.finished.catch(() => {});
    } else apply();
  };
  return (
    <div className={GROUP} role="group" aria-label="Theme">
      {(["light", "dark"] as const).map((t) => {
        const on = dark === (t === "dark");
        return (
          <button key={t} type="button" aria-label={t === "dark" ? "Dark theme" : "Light theme"} aria-pressed={on} onClick={() => set(t)} className={clsx(TILE, on && "text-surface hover:text-surface")}>
            {on && <motion.span layoutId="theme-active" className="absolute inset-0 rounded-[12px] bg-fg" transition={{ type: "spring", stiffness: 560, damping: 38 }} />}
            <svg viewBox="0 0 24 24" className="relative h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {t === "light" ? <><circle cx="12" cy="12" r="3.5" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></> : <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />}
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function Search() {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <Form action="/crm/contacts" role="search" className="relative min-w-0 flex-1 md:max-w-[26rem]">
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
      <input
        ref={input}
        name="q"
        type="search"
        aria-label="Search drivers"
        placeholder="Search drivers…"
        className="h-[52px] w-full rounded-[17px] border-[3px] border-line bg-surface pl-10 pr-4 text-[0.875rem] text-fg placeholder:text-faint transition-[border-color] duration-150 hover:border-line-strong focus:border-faint focus:outline-none"
      />
    </Form>
  );
}

function Team({ team }: { team: TopBarProps["team"] }) {
  if (!team.names.length) return null;
  const extra = team.total - team.names.length;
  const body = (
    <>
      {team.names.map((n) => <Avatar key={n} name={n} className="h-10 w-10 rounded-[12px] bg-surface" />)}
      {extra > 0 && <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-surface text-[0.8rem] font-medium text-fg-2">+{extra}</span>}
    </>
  );
  const label = `Team, ${team.total} ${team.total === 1 ? "person" : "people"}`;
  return team.href
    ? <Link href={team.href} aria-label={label} className={clsx(GROUP, "hidden transition-colors hover:border-line-strong lg:flex")}>{body}</Link>
    : <div aria-label={label} role="img" className={clsx(GROUP, "hidden lg:flex")}>{body}</div>;
}

/** Search, team, theme, unread and account. Everything here links to real data. */
export function TopBar({ me, team, unread, canSearch }: TopBarProps) {
  return (
    <div className="flex items-center gap-3 px-5 pb-3 pt-4 md:px-6">
      <div className="md:hidden"><BrandTile href="/crm" /></div>
      {canSearch ? <Search /> : <div className="flex-1" />}
      <Team team={team} />
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <div className="hidden sm:block"><ThemeToggle /></div>
        <div className={GROUP}>
          {unread !== null && (
            <Link href="/crm/inbox?f=unread" aria-label={unread ? `${unread} unread conversations` : "No unread conversations"} className={TILE}>
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 10a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6zM10 20a2 2 0 0 0 4 0" /></svg>
              {unread > 0 && <span className="absolute right-[9px] top-[9px] h-2 w-2 rounded-full border border-surface bg-red-500" />}
            </Link>
          )}
          <Link href="/crm/account" aria-label={`Your account, ${me.name}`} className="rounded-[12px] transition-opacity hover:opacity-80">
            <Avatar name={me.name} className="h-10 w-10 rounded-[12px] bg-surface" />
          </Link>
        </div>
      </div>
    </div>
  );
}

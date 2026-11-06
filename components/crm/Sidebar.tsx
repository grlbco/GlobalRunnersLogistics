"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "motion/react";
import { clsx } from "clsx";
import { crmSignOut } from "@/app/crm/auth-actions";
import { BrandTile } from "./BrandTile";

type Item = { href: string; label: string; icon: string };

const MAIN: Item[] = [
  { href: "/crm", label: "Dashboard", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { href: "/crm/inbox", label: "Inbox", icon: "M4 13h4l1.5 3h5L16 13h4M4 13l2.5-8h11L20 13v6H4z" },
  { href: "/crm/pipeline", label: "Pipeline", icon: "M4 5h4v14H4zM10 5h4v10h-4zM16 5h4v6h-4z" },
  { href: "/crm/contacts", label: "Contacts", icon: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5a6 6 0 0 1 3 5.5" },
  { href: "/crm/forms", label: "Forms", icon: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" },
  { href: "/crm/campaigns", label: "Campaigns", icon: "M4 12l16-7-5 15-3-6z" },
  { href: "/crm/automations", label: "Automations", icon: "M13 3 5 14h6l-1 7 8-11h-6z" },
  { href: "/crm/reports", label: "Reports", icon: "M5 19V11M10 19V6M15 19v-5M20 19V9" },
  { href: "/crm/assistant", label: "Assistant", icon: "M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6-5.6-1.9 5.6-1.9zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" },
];
const SECONDARY: Item[] = [
  { href: "/crm/team", label: "Team", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
  { href: "/crm/settings", label: "Settings", icon: "M4 7h10M18 7h2M4 17h2M10 17h10M16 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
];
const ACCOUNT: Item = { href: "/crm/account", label: "Account", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0" };
const SIGN_OUT = "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10";

const SPRING = { type: "spring", stiffness: 560, damping: 38 } as const;
const TILE = "relative flex h-11 w-full items-center overflow-hidden rounded-[13px] text-left transition-colors duration-150";
const RAIL_GROUP = "flex w-full flex-col gap-1 rounded-[17px] border-[3px] border-line bg-subtle p-[3px]";
// Labels stay hidden until the rail opens. Opens for a mouse hover or keyboard focus, not for a click, so it closes when the cursor leaves.
const LABEL = "relative truncate pr-3 text-[0.875rem] font-medium opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-has-[:focus-visible]/rail:opacity-100";

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={clsx("h-[19px] w-[19px] shrink-0", className)} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function RailLink({ item, on }: { item: Item; on: boolean }) {
  return (
    <Link href={item.href} aria-label={item.label} aria-current={on ? "page" : undefined} className={clsx(TILE, on ? "text-surface" : "bg-surface text-fg-2 hover:text-fg")}>
      {on && <motion.span layoutId="rail-active" className="absolute inset-0 rounded-[13px] bg-fg" transition={SPRING} />}
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center"><Icon d={item.icon} /></span>
      <span className={LABEL}>{item.label}</span>
    </Link>
  );
}

/** Floating icon rail on desktop, floating pill of tiles on phones. Only the sections this person may open. */
export function Sidebar({ allowed }: { allowed: string[]; me?: { name: string; role: string } }) {
  const path = usePathname();
  const active = (href: string) => (href === "/crm" ? path === "/crm" : path.startsWith(href));
  const main = MAIN.filter((i) => allowed.includes(i.href));
  const secondary = SECONDARY.filter((i) => allowed.includes(i.href));

  return (
    <>
      {/* The aside holds the rail's collapsed width, so opening slides over the page instead of pushing it. */}
      <aside className="sticky top-0 z-30 hidden h-dvh w-[5.25rem] shrink-0 md:block">
        <div className="group/rail absolute inset-y-0 left-0 flex w-[5.25rem] flex-col justify-between overflow-hidden rounded-r-[20px] px-[14px] py-4 transition-[width,background-color,box-shadow] duration-200 ease-house hover:w-[14.5rem] hover:bg-canvas hover:shadow-pop has-[:focus-visible]:w-[14.5rem] has-[:focus-visible]:bg-canvas has-[:focus-visible]:shadow-pop">
          <div className="flex items-center gap-3 pl-[6px]">
            <span className="shrink-0"><BrandTile href="/crm" /></span>
            <span className={clsx(LABEL, "!pr-0 leading-tight")}>
              <span className="block truncate text-fg">Command</span>
              <span className="block truncate text-[0.75rem] font-normal text-muted">Global Runners</span>
            </span>
          </div>
          <LayoutGroup id="crm-rail">
            <nav aria-label="Main" className={RAIL_GROUP}>
              {main.map((item) => <RailLink key={item.href} item={item} on={active(item.href)} />)}
            </nav>
            <div className={RAIL_GROUP}>
              {secondary.map((item) => <RailLink key={item.href} item={item} on={active(item.href)} />)}
              <form action={crmSignOut}>
                <button aria-label="Sign out" className={clsx(TILE, "bg-surface text-fg-2 hover:text-fg")}>
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center"><Icon d={SIGN_OUT} /></span>
                  <span className={LABEL}>Sign out</span>
                </button>
              </form>
            </div>
          </LayoutGroup>
        </div>
      </aside>

      {/* Phones: four sections + Account (the rest are listed on the Account page) */}
      <nav aria-label="Main" className="fixed inset-x-4 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 grid grid-cols-5 gap-1 rounded-[20px] border-[3px] border-line bg-subtle/90 p-[3px] shadow-pop backdrop-blur-xl md:hidden">
        <LayoutGroup id="crm-tabs">
          {[...main.slice(0, 4), ACCOUNT].map((item) => {
            const on = active(item.href);
            return (
              <Link key={item.href} href={item.href} aria-label={item.label} aria-current={on ? "page" : undefined} className={clsx("relative flex h-12 items-center justify-center rounded-[15px]", on ? "text-surface" : "bg-surface text-fg-2")}>
                {on && <motion.span layoutId="tab-active" className="absolute inset-0 rounded-[15px] bg-fg" transition={SPRING} />}
                <Icon d={item.icon} className="relative" />
              </Link>
            );
          })}
        </LayoutGroup>
      </nav>
    </>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "motion/react";
import { clsx } from "clsx";
import { crmSignOut } from "@/app/crm/auth-actions";
import { Avatar } from "@/components/crm/ui";

type Item = { href: string; label: string; icon: string };

const GROUPS: { label?: string; items: Item[] }[] = [
  {
    items: [
      { href: "/crm", label: "Dashboard", icon: "M4 5h6v6H4zM14 5h6v4h-6zM14 13h6v6h-6zM4 15h6v4H4z" },
      { href: "/crm/inbox", label: "Inbox", icon: "M4 13h4l1.5 3h5L16 13h4M4 13l2.5-7h11L20 13v6H4z" },
    ],
  },
  {
    label: "Drivers",
    items: [
      { href: "/crm/pipeline", label: "Pipeline", icon: "M4 5h4v14H4zM10 5h4v10h-4zM16 5h4v6h-4z" },
      { href: "/crm/contacts", label: "Contacts", icon: "M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20a7 7 0 0 1 14 0" },
      { href: "/crm/forms", label: "Forms", icon: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" },
    ],
  },
  {
    label: "Outreach",
    items: [
      { href: "/crm/campaigns", label: "Campaigns", icon: "M4 12l16-7-5 15-3-6z" },
      { href: "/crm/automations", label: "Automations", icon: "M13 3 5 14h6l-1 7 8-11h-6z" },
      { href: "/crm/assistant", label: "Assistant", icon: "M5 6h14v9H9l-4 3.5z" },
    ],
  },
  {
    label: "Insights",
    items: [{ href: "/crm/reports", label: "Reports", icon: "M5 19V11M10 19V6M15 19v-5M20 19V9" }],
  },
  {
    label: "Workspace",
    items: [
      { href: "/crm/team", label: "Team", icon: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5a6 6 0 0 1 3 5.5" },
      { href: "/crm/settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a7.4 7.4 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L15 3h-4l-.3 2.6a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.4 7.4 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1L11 21h4l.3-2.6a7 7 0 0 0 1.7-1l2.4 1 2-3.4z" },
    ],
  },
];

const ACCOUNT: Item = { href: "/crm/account", label: "Account", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0" };

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={clsx("h-[17px] w-[17px] shrink-0", className)} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function Sidebar({ allowed, me }: { allowed: string[]; me: { name: string; role: string } }) {
  const path = usePathname();
  const active = (href: string) => (href === "/crm" ? path === "/crm" : path.startsWith(href));
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => allowed.includes(i.href)) })).filter((g) => g.items.length);
  const flat = groups.flatMap((g) => g.items);

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-[15.5rem] shrink-0 flex-col px-3 py-3 md:flex">
        <Link href="/crm" className="flex items-center gap-2.5 rounded-[8px] px-2 py-2 transition-colors hover:bg-hover">
          <span className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-line bg-surface shadow-card">
            <Image src="/brand/mark-navy.png" alt="" width={18} height={18} className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-[0.875rem] font-semibold leading-tight tracking-[-0.015em]">Command</span>
            <span className="block truncate text-[0.7rem] leading-tight text-faint">Global Runners Logistics</span>
          </span>
        </Link>

        <LayoutGroup id="crm-nav">
          <nav className="mt-4 flex-1 space-y-4 overflow-y-auto">
            {groups.map((g, gi) => (
              <div key={gi}>
                {g.label && <p className="mb-1 px-2.5 text-[0.7rem] font-medium text-faint">{g.label}</p>}
                <div className="space-y-px">
                  {g.items.map((item) => {
                    const on = active(item.href);
                    return (
                      <Link key={item.href} href={item.href} className={clsx("relative flex items-center gap-2.5 rounded-[7px] px-2.5 py-[7px] text-[0.84rem] transition-colors", on ? "text-fg" : "text-muted hover:bg-hover hover:text-fg")}>
                        {on && (
                          <motion.span layoutId="nav-active" className="absolute inset-0 rounded-[7px] border border-line bg-surface shadow-card" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
                        )}
                        <Icon d={item.icon} className={clsx("relative", on ? "text-signal" : "text-faint")} />
                        <span className="relative font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </LayoutGroup>

        <div className="mt-3 flex items-center gap-2 rounded-[8px] border border-line bg-surface p-1.5 shadow-card">
          <Link href="/crm/account" className={clsx("flex min-w-0 flex-1 items-center gap-2.5 rounded-[6px] px-1.5 py-1 transition-colors hover:bg-hover", active("/crm/account") && "bg-hover")}>
            <Avatar name={me.name} className="h-7 w-7" />
            <span className="min-w-0">
              <span className="block truncate text-[0.8rem] font-medium text-fg">{me.name}</span>
              <span className="block truncate text-[0.7rem] text-faint">{me.role}</span>
            </span>
          </Link>
          <form action={crmSignOut}>
            <button aria-label="Sign out" title="Sign out" className="flex h-8 w-8 items-center justify-center rounded-[6px] text-faint transition-colors hover:bg-hover hover:text-fg">
              <Icon d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile bottom tabs: four sections + Account (the rest are listed on the Account page) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {[...flat.slice(0, 4), ACCOUNT].map((item) => (
          <Link key={item.href} href={item.href} className={clsx("flex flex-col items-center gap-1 py-2.5 text-[0.68rem] font-medium", active(item.href) ? "text-fg" : "text-faint")}>
            <Icon d={item.icon} className={active(item.href) ? "text-signal" : undefined} />
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { crmSignOut } from "@/app/crm/auth-actions";

const NAV: { href: string; label: string; icon: string; soon?: boolean }[] = [
  { href: "/crm", label: "Dashboard", icon: "M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z" },
  { href: "/crm/inbox", label: "Inbox", icon: "M4 4h16v12H5.2L4 17.2zM4 4l8 6 8-6" },
  { href: "/crm/pipeline", label: "Pipeline", icon: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v5h-4z" },
  { href: "/crm/contacts", label: "Contacts", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0" },
  { href: "/crm/forms", label: "Forms", icon: "M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7M9 8h3" },
  { href: "/crm/campaigns", label: "Campaigns", icon: "M3 11l18-8-8 18-2-8z" },
  { href: "/crm/automations", label: "Automations", icon: "M5 4v6h6M19 20v-6h-6M5 10a7 7 0 0 1 12-3M19 14a7 7 0 0 1-12 3" },
  { href: "/crm/reports", label: "Reports", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/crm/assistant", label: "Assistant", icon: "M4 6h16v10H8l-4 4z" },
  { href: "/crm/team", label: "Team", icon: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5a6.5 6.5 0 0 1 3.5 5.5" },
  { href: "/crm/settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-4-2 1-2-2V4h-4v2L9 8 7 7l-2 4 2 1v0l-2 1 2 4 2-1 2 2v2h4v-2l2-2 2 1 2-4z" },
];

const ACCOUNT = { href: "/crm/account", label: "Account", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0" };

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function Sidebar({ allowed, me }: { allowed: string[]; me: { name: string; role: string } }) {
  const path = usePathname();
  const active = (href: string) => (href === "/crm" ? path === "/crm" : path.startsWith(href));
  const items = NAV.filter((i) => allowed.includes(i.href));
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-white/[0.07] bg-[#0b1424] md:flex">
        <Link href="/crm" className="flex items-center gap-3 px-5 py-5">
          <Image src="/brand/mark-white.png" alt="" width={28} height={28} className="h-7 w-7" />
          <span className="text-[0.95rem] font-semibold tracking-[-0.02em]">Command</span>
        </Link>
        <nav className="mt-2 flex flex-col gap-0.5 px-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.soon ? "#" : item.href}
              aria-disabled={item.soon}
              className={clsx(
                "flex items-center gap-3 rounded-[4px] px-3 py-2 text-[0.9rem] transition-colors",
                active(item.href) ? "bg-white/[0.07] text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white",
                item.soon && "pointer-events-none opacity-40",
              )}
            >
              <Icon d={item.icon} />
              {item.label}
              {item.soon && <span className="ml-auto font-mono text-[0.6rem] uppercase tracking-wider text-white/40">soon</span>}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/[0.07] px-3 py-3">
          <Link href="/crm/account" className={clsx("block rounded-[4px] px-3 py-2 transition-colors", active("/crm/account") ? "bg-white/[0.07]" : "hover:bg-white/[0.04]")}>
            <span className="block truncate text-[0.85rem] text-white/85">{me.name}</span>
            <span className="block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-white/40">{me.role}</span>
          </Link>
          <form action={crmSignOut}>
            <button className="mt-1 w-full rounded-[4px] px-3 py-2 text-left text-[0.8rem] text-white/45 transition-colors hover:bg-white/[0.04] hover:text-white">Sign out</button>
          </form>
        </div>
      </aside>
      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-[#0b1424]/95 backdrop-blur md:hidden">
        {[...items.filter((i) => !i.soon).slice(0, 4), ACCOUNT].map((item) => (
          <Link key={item.href} href={item.href} className={clsx("flex flex-col items-center gap-1 py-2.5 text-[0.7rem]", active(item.href) ? "text-white" : "text-white/45")}>
            <Icon d={item.icon} />
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

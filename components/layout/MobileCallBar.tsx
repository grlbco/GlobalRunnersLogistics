"use client";

import { usePathname } from "next/navigation";
import { stripLocale } from "@/lib/i18n";
import Link from "next/link";
import { company } from "@/content/facts";
import { routes } from "@/content/navigation";
import { localePath, type Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries/en";

/** Sticky bottom bar on phones: drivers can call or apply with one thumb. */
export function MobileCallBar({ locale, nav }: { locale: Locale; nav: Dictionary["nav"] }) {
  const path = stripLocale(usePathname());
  // Hidden where it would compete with the page's own form or portal UI.
  if (/^\/(apply|f|login|register|reset-password|update-password|dashboard)(\/|$)/.test(path)) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-px border-t border-white/10 bg-white/10 pb-[env(safe-area-inset-bottom)] sm:hidden">
      <a href={`tel:${company.phone.e164}`} className="flex h-14 items-center justify-center gap-2 bg-ink text-[0.95rem]">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
          <path
            d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        {nav.call}
      </a>
      <Link href={localePath(locale, routes.applyDriver)} className="flex h-14 items-center justify-center bg-signal text-[0.95rem] font-medium">
        {nav.apply}
      </Link>
    </div>
  );
}

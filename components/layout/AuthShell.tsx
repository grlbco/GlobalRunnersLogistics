import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/Logo";

/** Two-column auth layout: brand panel + form. */
export function AuthShell({ label, title, intro, children }: { label: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="min-h-svh pb-20 pt-28 md:pt-36">
      <div className="container-site grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <LogoMark className="h-14 w-14 text-silver" />
          <p className="label mt-10 text-white/50">{label}</p>
          <h1 className="display mt-4 max-w-[12ch]">{title}</h1>
          {intro && <p className="body-lg mt-6 max-w-md text-white/65">{intro}</p>}
        </div>
        <div className="lg:col-span-5 lg:col-start-8">
          <div className="border border-white/10 bg-navy/60 p-6 md:p-10">{children}</div>
        </div>
      </div>
    </section>
  );
}

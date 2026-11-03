import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal, RevealLines } from "@/components/motion/Reveal";

export function PageHero({
  crumbs,
  label,
  title,
  intro,
  children,
}: {
  crumbs?: { name: string; href: string }[];
  label: string;
  title: readonly string[];
  intro?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-white/10 pb-16 pt-36 md:pb-24 md:pt-48">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_85%_0%,#13213a_0%,#0a1220_70%)]" />
      <div className="container-site">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-10">
            <ol className="label flex flex-wrap items-center gap-2 text-white/40">
              {crumbs.map((c, i) => (
                <li key={c.href} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden>/</span>}
                  {i < crumbs.length - 1 ? (
                    <Link href={c.href} className="hover:text-white">
                      {c.name}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-white/70">
                      {c.name}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <Reveal>
          <p className="label flex items-center gap-3 text-white/60">
            <span className="h-2 w-2 rounded-full bg-signal" />
            {label}
          </p>
        </Reveal>
        <h1 className="display mt-6 max-w-[18ch]">
          <RevealLines lines={title} />
        </h1>
        {intro && (
          <Reveal delay={0.2}>
            <div className="body-lg mt-8 max-w-2xl text-white/70">{intro}</div>
          </Reveal>
        )}
        {children && <Reveal delay={0.3} className="mt-10">{children}</Reveal>}
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink, Arrow } from "@/components/ui/Button";
import { routes } from "@/content/navigation";
import { company } from "@/content/facts";
import { localePath, stripLocale, type Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries/en";

const ease = [0.22, 1, 0.36, 1] as const;

export function Header({ locale, nav }: { locale: Locale; nav: Dictionary["nav"] }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const lastY = useRef(0);
  const p = (path: string) => localePath(locale, path);

  // Solid background after leaving the top; hide on scroll down, reveal on scroll up.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      setHidden(y > 240 && y > lastY.current && !mobileOpen);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mobileOpen]);

  // Close menus on route change (adjust state during render instead of in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMegaOpen(false);
    setMobileOpen(false);
  }

  useEffect(() => {
    document.documentElement.classList.toggle("menu-open", mobileOpen);
    const lenis = (window as unknown as { __lenis?: { stop(): void; start(): void } }).__lenis;
    if (mobileOpen) lenis?.stop();
    else lenis?.start();
  }, [mobileOpen]);

  const bare = stripLocale(pathname);
  const altLocale: Locale = locale === "en" ? "es" : "en";
  const isActive = (path: string) => bare === path || bare.startsWith(path + "/");

  const driveItems = [
    { href: routes.drive, ...nav.driveItems.company },
    { href: routes.team, ...nav.driveItems.team },
    { href: routes.solo, ...nav.driveItems.solo },
    { href: routes.pay, ...nav.driveItems.pay },
    { href: routes.requirements, ...nav.driveItems.requirements },
  ];
  const mainLinks = [
    { href: routes.ownerOperators, label: nav.ownerOperators },
    { href: routes.about, label: nav.about },
    { href: routes.locations, label: nav.locations },
    { href: routes.contact, label: nav.contact },
  ];

  return (
    <>
      <header
        className={clsx(
          "fixed inset-x-0 top-0 z-50 transition-[transform,background-color,border-color] duration-500 ease-house",
          hidden && !megaOpen ? "-translate-y-full" : "translate-y-0",
          megaOpen || mobileOpen
            ? "border-b border-white/10 bg-ink"
            : scrolled
            ? "border-b border-white/10 bg-ink/85 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent",
        )}
        onMouseLeave={() => setMegaOpen(false)}
      >
        <div className="container-site flex h-16 items-center justify-between md:h-20">
          <Link href={p("/")} className="relative z-10" aria-label={company.shortName}>
            <Logo />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            <button
              type="button"
              className={clsx(
                "flex h-10 items-center gap-1.5 rounded px-3 text-[0.95rem] transition-colors",
                megaOpen || isActive(routes.drive) ? "text-white" : "text-white/70 hover:text-white",
              )}
              aria-expanded={megaOpen}
              aria-controls="mega-drive"
              onMouseEnter={() => setMegaOpen(true)}
              onClick={() => setMegaOpen((v) => !v)}
            >
              {nav.drive}
              <svg viewBox="0 0 10 6" className={clsx("h-1.5 w-2.5 transition-transform", megaOpen && "rotate-180")} aria-hidden>
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" />
              </svg>
            </button>
            {mainLinks.map((l) => (
              <Link
                key={l.href}
                href={p(l.href)}
                onMouseEnter={() => setMegaOpen(false)}
                className={clsx(
                  "relative flex h-10 items-center rounded px-3 text-[0.95rem] transition-colors",
                  isActive(l.href) ? "text-white" : "text-white/70 hover:text-white",
                )}
              >
                {l.label}
                {isActive(l.href) && <span className="absolute inset-x-3 -bottom-0.5 h-px bg-signal" />}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:gap-4">
            <Link
              href={localePath(altLocale, bare)}
              hrefLang={altLocale}
              className="label hidden h-10 items-center px-2 text-white/60 transition-colors hover:text-white md:flex"
              aria-label={altLocale === "es" ? "Ver en español" : "View in English"}
            >
              {altLocale.toUpperCase()}
            </Link>
            <Link href={p(routes.login)} className="hidden text-[0.95rem] text-white/70 transition-colors hover:text-white lg:block">
              {nav.login}
            </Link>
            <span className="hidden sm:block">
              <ButtonLink href={p(routes.applyDriver)} className="h-11">
                {nav.apply}
              </ButtonLink>
            </span>
            <button
              type="button"
              className="relative flex h-11 w-11 items-center justify-center lg:hidden"
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              aria-label={mobileOpen ? nav.close : nav.menu}
              onClick={() => setMobileOpen((v) => !v)}
            >
              <span className={clsx("absolute h-[1.5px] w-6 bg-white transition-transform duration-500 ease-house", mobileOpen ? "rotate-45" : "-translate-y-[4px]")} />
              <span className={clsx("absolute h-[1.5px] w-6 bg-white transition-transform duration-500 ease-house", mobileOpen ? "-rotate-45" : "translate-y-[4px]")} />
            </button>
          </div>
        </div>

        {/* Mega menu */}
        <AnimatePresence>
          {megaOpen && (
            <motion.div
              id="mega-drive"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease }}
              className="hidden border-t border-white/10 lg:block"
            >
              <div className="container-site grid grid-cols-12 gap-6 py-10">
                <div className="col-span-3">
                  <p className="label text-white/50">01 — {nav.drive}</p>
                  <p className="mt-4 max-w-[16rem] text-sm leading-relaxed text-white/60">
                    CDL-A · 53&apos; dry van · Henderson, NV
                  </p>
                </div>
                <ul className="col-span-9 grid grid-cols-3 gap-px bg-white/10">
                  {driveItems.map((item, i) => (
                    <motion.li
                      key={item.href}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease, delay: 0.04 * i }}
                      className="bg-ink"
                    >
                      <Link href={p(item.href)} className="group flex h-full flex-col justify-between gap-6 p-5 transition-colors hover:bg-navy">
                        <span className="label text-white/40">0{i + 1}</span>
                        <span>
                          <span className="flex items-center justify-between text-lg font-medium">
                            {item.label}
                            <Arrow className="-translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                          </span>
                          <span className="mt-1 block text-sm text-white/55">{item.hint}</span>
                        </span>
                      </Link>
                    </motion.li>
                  ))}
                  <li className="bg-signal">
                    <Link href={p(routes.applyDriver)} className="group flex h-full flex-col justify-between gap-6 p-5">
                      <span className="label text-white/70">→</span>
                      <span className="flex items-center justify-between text-lg font-medium">
                        {nav.apply}
                        <Arrow className="transition-transform group-hover:translate-x-1" />
                      </span>
                    </Link>
                  </li>
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-menu"
            className="fixed inset-0 z-40 flex flex-col bg-ink pt-16 lg:hidden"
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.6, ease }}
          >
            <nav className="container-site flex flex-1 flex-col overflow-y-auto pb-8 pt-6" aria-label="Mobile">
              <ul className="flex flex-col">
                {[{ href: routes.drive, label: nav.drive }, ...mainLinks, { href: routes.login, label: nav.login }].map((l, i) => (
                  <motion.li
                    key={l.href}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease, delay: 0.15 + i * 0.05 }}
                    className="border-b border-white/10"
                  >
                    <Link href={p(l.href)} className="flex items-baseline justify-between py-4">
                      <span className="text-[2rem] font-semibold leading-none tracking-[-0.03em]">{l.label}</span>
                      <span className="label text-white/40">0{i + 1}</span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
              <motion.div
                className="mt-auto flex flex-col gap-3 pt-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
              >
                <ButtonLink href={p(routes.applyDriver)} arrow className="h-14 w-full">
                  {nav.apply}
                </ButtonLink>
                <div className="flex gap-3">
                  <a href={`tel:${company.phone.e164}`} className="flex h-14 flex-1 items-center justify-center rounded border border-white/20 text-[0.95rem]">
                    {nav.call} {company.phone.display}
                  </a>
                  <Link
                    href={localePath(altLocale, bare)}
                    hrefLang={altLocale}
                    className="label flex h-14 w-16 items-center justify-center rounded border border-white/20"
                  >
                    {altLocale.toUpperCase()}
                  </Link>
                </div>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

import type { Metadata } from "next";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Design system", robots: { index: false, follow: false } };

const colors = [
  ["ink", "#0A1220", "Primary background"],
  ["navy", "#13213A", "Logo navy, surfaces"],
  ["steel", "#2A3A55", "Borders on dark"],
  ["silver", "#C7CDD6", "Logo silver, secondary text"],
  ["fog", "#EEF0F3", "Light sections"],
  ["signal", "#E8401C", "Actions, key numbers"],
  ["signal-ink", "#B32E10", "Hover / pressed"],
  ["dusk", "#F2A65A", "Hero footage accents only"],
] as const;

/** Internal specimen page (noindex) for reviewing tokens. docs/plan/02 */
export default function DesignPage() {
  return (
    <div className="container-site space-y-24 pb-32 pt-40">
      <header>
        <p className="label text-white/40">Internal — design system v0.1</p>
        <h1 className="display mt-6">Global Runners</h1>
      </header>

      <section>
        <p className="label text-white/40">01 — Logo</p>
        <div className="mt-6 flex flex-wrap items-center gap-10">
          <LogoMark className="h-28" />
          <Logo className="h-16 md:h-16" />
          <div className="rounded bg-fog p-6">
            <Logo tone="dark" className="h-16 md:h-16" />
          </div>
        </div>
      </section>

      <section>
        <p className="label text-white/40">02 — Color</p>
        <ul className="mt-6 grid grid-cols-2 gap-px bg-white/10 md:grid-cols-4">
          {colors.map(([name, hex, use]) => (
            <li key={name} className="bg-ink p-4">
              <div className="h-24 rounded-sm border border-white/10" style={{ background: hex }} />
              <p className="mt-3 font-medium">{name}</p>
              <p className="label mt-1 text-white/50">{hex}</p>
              <p className="mt-2 text-sm text-white/55">{use}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <p className="label text-white/40">03 — Type · Geist Sans / Geist Mono (SIL OFL)</p>
        <div className="mt-8 space-y-8">
          <p className="display-xl">Your road.</p>
          <p className="display">Built for the long haul.</p>
          <p className="h2">Weekly pay, every Thursday.</p>
          <p className="h3">Peterbilt 579 · Freightliner Cascadia · Automatic</p>
          <p className="body-lg max-w-2xl text-white/70">
            Drive for a Las Vegas fleet that keeps you moving: consistent runs, weekly pay, 24/7 dispatch, and home time you can plan
            around. Aa Bb Cc 0123456789 ñ á é í ó ú ¿ ¡
          </p>
          <p className="label text-white/60">01 — Fleet · MC pending · 53&apos; dry van</p>
          <div className="flex flex-wrap gap-2 text-4xl font-semibold tracking-tight">
            {[300, 400, 500, 600, 700, 800].map((w) => (
              <span key={w} style={{ fontWeight: w }} className="rounded border border-white/10 px-4 py-2">
                Aa <span className="label align-middle text-white/40">{w}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section>
        <p className="label text-white/40">04 — Buttons</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="#" arrow>
            Apply now
          </ButtonLink>
          <ButtonLink href="#" variant="outline">
            See pay
          </ButtonLink>
          <ButtonLink href="#" variant="ghost" arrow>
            Call dispatch
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}

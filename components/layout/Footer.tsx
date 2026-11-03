import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { routes } from "@/content/navigation";
import { company } from "@/content/facts";
import { localePath, type Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries/en";

/** Cached at build/revalidation time so prerendering stays static. */
async function CopyrightYear() {
  "use cache";
  return <>{new Date().getFullYear()}</>;
}

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const p = (path: string) => localePath(locale, path);
  const f = dict.footer;
  const cols = [
    {
      title: f.columns.drivers,
      links: [
        [f.links.jobs, routes.drive],
        [f.links.apply, routes.applyDriver],
        [f.links.pay, routes.pay],
        [f.links.requirements, routes.requirements],
        [f.links.owners, routes.ownerOperators],
      ],
    },
    {
      title: f.columns.company,
      links: [
        [f.links.about, routes.about],
        [f.links.locations, routes.locations],
        [f.links.contact, routes.contact],
        [f.links.faq, routes.faq],
      ],
    },
    {
      title: f.columns.legal,
      links: [
        [f.links.privacy, routes.privacy],
        [f.links.terms, routes.terms],
        [f.links.sms, routes.sms],
        [f.links.eeo, routes.eeo],
      ],
    },
  ] as const;

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-ink pt-20 md:pt-28">
      <div className="container-site">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <LogoMark className="h-14 w-14 text-silver" />
            <p className="mt-6 max-w-sm text-white/60 body-lg">{f.tagline}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={p(routes.applyDriver)} arrow>
                {dict.nav.apply}
              </ButtonLink>
              <ButtonLink href={`tel:${company.phone.e164}`} variant="outline">
                {company.phone.display}
              </ButtonLink>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 md:col-span-7">
            {cols.map((c) => (
              <div key={c.title}>
                <p className="label text-white/40">{c.title}</p>
                <ul className="mt-5 space-y-3">
                  {c.links.map(([label, href]) => (
                    <li key={href}>
                      <Link href={p(href)} className="text-white/75 transition-colors hover:text-white">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 border-t border-white/10 pt-10 text-sm text-white/60 sm:grid-cols-3">
          <div>
            <p className="label text-white/40">{f.office}</p>
            <address className="mt-3 not-italic leading-relaxed">
              {company.office.street}
              <br />
              {company.office.city}, {company.office.region} {company.office.postalCode}
            </address>
          </div>
          <div>
            <p className="label text-white/40">{f.yard}</p>
            <p className="mt-3 leading-relaxed">
              {company.yard.city}, {company.yard.region}
            </p>
          </div>
          <div>
            <p className="label text-white/40">24/7</p>
            <p className="mt-3 leading-relaxed">{f.hours}</p>
          </div>
        </div>
      </div>

      {/* Giant wordmark */}
      <div aria-hidden className="pointer-events-none mt-16 select-none overflow-hidden">
        <p
          className="whitespace-nowrap text-center font-semibold uppercase leading-[0.8] tracking-[-0.05em] text-transparent"
          style={{ fontSize: "clamp(3rem, 11.6vw, 14rem)", WebkitTextStroke: "1px rgba(199,205,214,0.35)" }}
        >
          Global Runners
        </p>
      </div>

      <div className="container-site flex flex-col justify-between gap-2 border-t border-white/10 py-6 pb-20 text-xs text-white/45 sm:flex-row sm:pb-6">
        <p>
          © <CopyrightYear /> {company.legalName}. {f.rights}
        </p>
        <p className="font-mono">globalrunnerslogistics.com</p>
      </div>
    </footer>
  );
}

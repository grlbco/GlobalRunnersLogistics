import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveLocale, localePath, locales } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { routes } from "@/content/navigation";
import { getPlace, places } from "@/content/locations";
import { jobs } from "@/content/jobs";
import { company, pay } from "@/content/facts";
import { PageHero } from "@/components/ui/PageHero";
import { Section } from "@/components/ui/Section";
import { FaqList } from "@/components/ui/Faq";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink, Arrow } from "@/components/ui/Button";
import { CtaBand } from "@/components/sections/CtaBand";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, faqSchema, placeSchema } from "@/lib/schema";
import type { Faq } from "@/content/faq";

export function generateStaticParams() {
  return locales.flatMap((lang) => places.map((pl) => ({ lang, slug: pl.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/locations/[slug]">) {
  const lang = await resolveLocale(params);
  const { slug } = await params;
  const pl = getPlace(slug);
  if (!pl) return {};
  return pageMeta(
    lang,
    `/locations/${pl.slug}`,
    `CDL-A Truck Driving Jobs in ${pl.city}, NV`,
    `Hiring CDL-A solo and team drivers in ${pl.city}, NV. Trucks start from our Henderson yard${pl.milesToYard ? ` (~${pl.minutesToYard} min away)` : ""}. Weekly pay every ${pay.payday}, take the truck home.`,
  );
}

export default async function PlacePage({ params }: PageProps<"/[lang]/locations/[slug]">) {
  const lang = await resolveLocale(params);
  const { slug } = await params;
  const pl = getPlace(slug);
  if (!pl) notFound();
  const p = (path: string) => localePath(lang, path);
  const nearby = places.filter((x) => x.slug !== pl.slug).slice(0, 4);

  const localFaq: Faq[] = [
    {
      group: "Hiring",
      q: `Is Global Runners Logistics hiring CDL-A drivers in ${pl.city}, NV?`,
      a: `Yes. We hire CDL-A solo and team drivers who live in ${pl.city} and across Southern Nevada. Trucks start from our yard in Henderson.`,
    },
    {
      group: "Hiring",
      q: `How far is the truck yard from ${pl.city}?`,
      a: pl.milesToYard === 0 ? "The yard is in Henderson, so you're right next to it." : `About ${pl.milesToYard} miles — roughly ${pl.minutesToYard} minutes by car via ${pl.highways.join(", ")}. You can take the truck home, so the trip only happens at the start and end of a run.`,
    },
    {
      group: "Pay",
      q: `How do drivers from ${pl.city} get paid?`,
      a: `Weekly, every ${pay.payday}. The pay period runs ${pay.payPeriod}. Layover pays $${pay.layover}, and every driver earns a $${pay.anniversaryBonus.toLocaleString()} anniversary bonus each year.`,
    },
  ];

  return (
    <>
      <JsonLd
        data={[
          placeSchema(pl),
          faqSchema(localFaq),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Locations", path: routes.locations },
            { name: `${pl.city}, NV`, path: `/locations/${pl.slug}` },
          ]),
        ]}
      />
      <PageHero
        crumbs={[{ name: "Home", href: p("/") }, { name: "Locations", href: p(routes.locations) }, { name: `${pl.city}, NV`, href: p(`/locations/${pl.slug}`) }]}
        label={`Hiring in ${pl.city}, NV`}
        title={["CDL-A jobs", `in ${pl.city}.`]}
        intro={`${pl.intro} Global Runners Logistics hires solo and team CDL-A drivers for 53' dry van runs — weekly pay every ${pay.payday}, automatic trucks, and you take the truck home.`}
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={p(routes.applyDriver)} arrow className="h-14 px-7">Apply now</ButtonLink>
          <ButtonLink href={`tel:${company.phone.e164}`} variant="outline" className="h-14 px-7">Call {company.phone.display}</ButtonLink>
        </div>
      </PageHero>

      <section className="border-b border-white/10">
        <div className="container-site grid grid-cols-1 sm:grid-cols-3">
          {[
            { k: "To the Henderson yard", v: pl.milesToYard === 0 ? "You're here" : `~${pl.milesToYard} mi` },
            { k: "Drive time", v: pl.minutesToYard === 0 ? "—" : `~${pl.minutesToYard} min` },
            { k: "Main routes", v: pl.highways.join(" · ") },
          ].map((s, i) => (
            <Reveal key={s.k} delay={i * 0.05} className="border-white/10 py-10 sm:border-r sm:px-8 sm:first:pl-0 sm:last:border-r-0">
              <p className="h2">{s.v}</p>
              <p className="label mt-3 text-white/45">{s.k}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <Section index="01" label="Open positions" title={[`Jobs for ${pl.city} drivers.`]}>
        <ul className="mt-12 border-t border-white/15">
          {jobs.map((j) => (
            <li key={j.slug} className="border-b border-white/15">
              <Link href={p(`/drive/${j.slug}`)} className="group flex items-center justify-between gap-6 py-6">
                <span>
                  <span className="label text-signal">{j.driverType} · {j.runType}</span>
                  <span className="mt-2 block text-xl font-medium md:text-2xl">{j.title.split(" — ")[0]}</span>
                </span>
                <Arrow className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section index="02" label="Questions" title={[`Driving from ${pl.city}.`]} tone="navy">
        <div className="mt-12 md:ml-[25%]">
          <FaqList items={localFaq} />
        </div>
      </Section>

      <Section index="03" label="Nearby" title={["Other hiring areas."]}>
        <div className="mt-10 flex flex-wrap gap-3">
          {nearby.map((n) => (
            <Link key={n.slug} href={p(`/locations/${n.slug}`)} className="rounded-full border border-white/20 px-5 py-2.5 transition-colors hover:border-white">
              {n.city}, NV
            </Link>
          ))}
        </div>
      </Section>
      <CtaBand lang={lang} />
    </>
  );
}

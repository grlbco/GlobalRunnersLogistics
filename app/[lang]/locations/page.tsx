import Link from "next/link";
import { resolveLocale, localePath } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { routes } from "@/content/navigation";
import { company } from "@/content/facts";
import { places } from "@/content/locations";
import { PageHero } from "@/components/ui/PageHero";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/motion/Reveal";
import { Arrow } from "@/components/ui/Button";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, localBusinessSchema } from "@/lib/schema";

export async function generateMetadata({ params }: PageProps<"/[lang]/locations">) {
  const lang = await resolveLocale(params);
  return pageMeta(lang, routes.locations, "Locations — Las Vegas Office & Henderson Truck Yard", "Global Runners Logistics office at 732 S 6th St, Las Vegas, NV and truck yard in Henderson, NV. Hiring CDL-A drivers across Southern Nevada.");
}

export default async function LocationsPage({ params }: PageProps<"/[lang]/locations">) {
  const lang = await resolveLocale(params);
  const p = (path: string) => localePath(lang, path);
  const mapQuery = encodeURIComponent(`${company.office.street}, ${company.office.city}, ${company.office.region} ${company.office.postalCode}`);
  return (
    <>
      <JsonLd data={[localBusinessSchema(), breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Locations", path: routes.locations }])]} />
      <PageHero
        crumbs={[{ name: "Home", href: p("/") }, { name: "Locations", href: p(routes.locations) }]}
        label="Locations"
        title={["Based in Las Vegas.", "Running all 48."]}
        intro="Our office is in downtown Las Vegas and our trucks start from the Henderson yard. We hire CDL-A drivers across Southern Nevada."
      />
      <Section index="01" label="Where to find us" title={["Office & yard."]}>
        <div className="mt-14 grid gap-4 lg:grid-cols-2">
          <Reveal className="bg-navy p-8">
            <p className="label text-white/45">Office</p>
            <address className="mt-4 text-2xl not-italic leading-snug">
              {company.office.street}
              <br />
              {company.office.city}, {company.office.region} {company.office.postalCode}
            </address>
            <p className="mt-4 text-white/60">{company.timeZone} · <a href={`tel:${company.phone.e164}`} className="underline underline-offset-2">{company.phone.display}</a></p>
            <a className="mt-6 inline-flex items-center gap-2 font-medium text-signal" href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer">
              Open in Maps <Arrow />
            </a>
          </Reveal>
          <Reveal delay={0.08} className="bg-navy p-8">
            <p className="label text-white/45">Truck yard</p>
            <p className="mt-4 text-2xl leading-snug">
              {company.yard.city}, {company.yard.region}
            </p>
            <p className="mt-4 text-white/60">Truck pickup and orientation. Exact address is shared when your orientation is booked.</p>
          </Reveal>
        </div>
      </Section>
      <Section index="02" label="Hiring areas" title={["CDL-A jobs near you."]} tone="navy"
        intro="We hire drivers who live in Nevada. Distances are approximate drive times to the Henderson yard — and since you can take the truck home, you only make the trip at the start and end of a run.">
        <ul className="mt-14 grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {places.map((pl, i) => (
            <Reveal as="li" key={pl.slug} delay={(i % 3) * 0.05} className="bg-navy">
              <Link href={p(`/locations/${pl.slug}`)} className="group flex h-full flex-col justify-between gap-10 p-7 transition-colors hover:bg-steel">
                <span className="label text-white/45">{pl.highways.join(" · ")}</span>
                <span>
                  <span className="h3 block">{pl.city}, NV</span>
                  <span className="mt-2 flex items-center justify-between text-white/60">
                    {pl.milesToYard === 0 ? "Home of the yard" : `~${pl.milesToYard} mi · ~${pl.minutesToYard} min to yard`}
                    <Arrow className="transition-transform group-hover:translate-x-1" />
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </Section>
    </>
  );
}

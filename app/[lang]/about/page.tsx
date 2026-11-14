import { resolveLocale, localePath } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { routes } from "@/content/navigation";
import { company, fleet } from "@/content/facts";
import { about } from "@/content/about";
import { PageHero } from "@/components/ui/PageHero";
import { Section } from "@/components/ui/Section";
import { Reveal, Counter } from "@/components/motion/Reveal";
import { CtaBand } from "@/components/sections/CtaBand";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, organizationSchema } from "@/lib/schema";

export async function generateMetadata({ params }: PageProps<"/[lang]/about">) {
  const lang = await resolveLocale(params);
  return pageMeta(lang, routes.about, "About Global Runners Logistics — Las Vegas Trucking Company", `Global Runners Logistics LLC is a ${fleet.trucks}-truck dry van carrier in Las Vegas, NV, hauling since ${company.foundedYear}.`);
}

export default async function AboutPage({ params }: PageProps<"/[lang]/about">) {
  const lang = await resolveLocale(params);
  const p = (path: string) => localePath(lang, path);
  const stats = [
    { n: company.foundedYear, k: "Hauling since", group: false },
    { n: fleet.trucks, k: "Trucks", group: true },
    { n: 48, k: "States served", group: true },
    { n: 24, k: "Hour dispatch", group: true },
  ];
  const haul = [
    { k: "Equipment", v: fleet.trailer },
    { k: "Freight", v: fleet.freight },
    { k: "Loading", v: fleet.loading.join(" · ") },
    { k: "Service", v: fleet.runTypes.join(" · ") },
    { k: "Main lane", v: `${fleet.mainLane.from} ↔ ${fleet.mainLane.to}` },
    { k: "Coverage", v: "48 states — no Canada or Mexico" },
  ];
  return (
    <>
      <JsonLd data={[organizationSchema(), breadcrumbSchema([{ name: "Home", path: "/" }, { name: "About", path: routes.about }])]} />
      <PageHero
        crumbs={[{ name: "Home", href: p("/") }, { name: "About", href: p(routes.about) }]}
        label="About us"
        title={["A Las Vegas-based fleet", "built on consistency,", "dedication, and opportunity."]}
        intro={`${company.legalName} has been hauling freight since ${company.foundedYear}. Today we run ${fleet.trucks} trucks out of Las Vegas and Henderson, Nevada — and we're growing.`}
      />
      <section className="border-b border-white/10">
        <div className="container-site grid grid-cols-2 md:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.k} delay={i * 0.05} className="border-white/10 py-12 pr-6 [&:not(:last-child)]:border-r max-md:[&:nth-child(2)]:border-r-0 md:px-8 md:first:pl-0">
              <Counter to={s.n} grouping={s.group} className="display block" />
              <p className="label mt-3 text-white/45">{s.k}</p>
            </Reveal>
          ))}
        </div>
      </section>
      <Section index="01" label="Our story" title={["Driven by family.", "Built on commitment."]}>
        <div className="mt-12 grid gap-10 md:ml-[25%] md:grid-cols-2">
          {about.story.map((t, i) => (
            <Reveal key={i} delay={(i % 2) * 0.1} className={i === 0 ? "md:col-span-2" : undefined}>
              <p className={i === 0 ? "text-2xl font-medium leading-snug md:text-3xl" : "body-lg text-white/75"}>{t}</p>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-14 border-t border-white/10 pt-10 md:ml-[25%]">
          <p className="h3 max-w-[28ch]">{about.closer}</p>
          <p className="label mt-6 text-signal">{about.signoff}</p>
        </Reveal>
      </Section>
      <Section index="02" label="What we haul" title={["53' dry van,", "coast to coast."]} tone="light">
        <dl className="mt-14 border-t border-ink/15 md:ml-[25%]">
          {haul.map((h) => (
            <Reveal key={h.k} className="grid grid-cols-12 gap-4 border-b border-ink/15 py-6">
              <dt className="label col-span-12 text-ink/50 sm:col-span-4">{h.k}</dt>
              <dd className="col-span-12 text-xl font-medium sm:col-span-8">{h.v}</dd>
            </Reveal>
          ))}
        </dl>
      </Section>
      <Section index="03" label="Where we are" title={["Las Vegas office.", "Henderson yard."]}>
        <div className="mt-14 grid gap-px bg-white/10 md:ml-[25%] md:grid-cols-2">
          <div className="bg-ink p-8">
            <p className="label text-white/45">Office</p>
            <address className="mt-4 text-xl not-italic leading-snug">
              {company.office.street}
              <br />
              {company.office.city}, {company.office.region} {company.office.postalCode}
            </address>
          </div>
          <div className="bg-ink p-8">
            <p className="label text-white/45">Truck yard</p>
            <p className="mt-4 text-xl leading-snug">
              {company.yard.city}, {company.yard.region}
            </p>
            <p className="mt-2 text-white/55">Truck pickup and orientation</p>
          </div>
        </div>
      </Section>
      <CtaBand lang={lang} title="Drive with us." />
    </>
  );
}

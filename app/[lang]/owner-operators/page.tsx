import { resolveLocale, localePath } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { routes } from "@/content/navigation";
import { company, fleet } from "@/content/facts";
import { PageHero } from "@/components/ui/PageHero";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/motion/Reveal";
import { OwnerOperatorForm } from "@/components/forms/OwnerOperatorForm";
import { JsonLd } from "@/components/seo/JsonLd";
import { ButtonLink } from "@/components/ui/Button";
import { breadcrumbSchema } from "@/lib/schema";

export async function generateMetadata({ params }: PageProps<"/[lang]/owner-operators">) {
  const lang = await resolveLocale(params);
  return pageMeta(lang, routes.ownerOperators, "Owner-Operator Program — Coming Soon | Global Runners Logistics", "Our owner-operator program is coming soon. Right now Global Runners Logistics hires CDL-A company drivers. Leave your info and we'll reach out when it opens.");
}

// What the program will look like (shown as a preview while it's coming soon).
const points = [
  { t: "Consistent freight", d: `Steady ${fleet.trailer} loads, mostly ${fleet.freight.toLowerCase()}, on lanes we run every week — including our ${fleet.mainLane.from} ↔ ${fleet.mainLane.to} lane.` },
  { t: "Dispatch that answers", d: "A dedicated dispatcher, 24/7, in English and Spanish. Planned loads, less waiting at docks." },
  { t: "Las Vegas home base", d: `Office in ${company.office.city}, yard in ${company.yard.city}. A local team you can actually visit.` },
  { t: "Straight talk on terms", d: "We go over the full program terms with you on the first call, before you commit to anything." },
];

export default async function OwnerOperatorsPage({ params }: PageProps<"/[lang]/owner-operators">) {
  const lang = await resolveLocale(params);
  const p = (path: string) => localePath(lang, path);
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Owner-operators", path: routes.ownerOperators }])} />
      <PageHero
        crumbs={[{ name: "Home", href: p("/") }, { name: "Owner-operators", href: p(routes.ownerOperators) }]}
        label="Owner-operators · Coming soon"
        title={["Your truck.", "Coming soon."]}
        intro={`Right now we're hiring CDL-A company drivers only. Our owner-operator program with a Las Vegas fleet hauling since ${company.foundedYear} is coming soon. Leave your info and we'll reach out as soon as it opens.`}
      />
      <section className="border-b border-white/10 bg-signal/10">
        <div className="container-site flex flex-col gap-4 py-8 md:flex-row md:items-center md:justify-between">
          <p className="text-white/85">
            <span className="mr-3 inline-block rounded-full bg-signal px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">Coming soon</span>
            Have a CDL-A and want to drive now? We&apos;re hiring company drivers today.
          </p>
          <ButtonLink href={p(routes.applyDriver)} arrow className="h-12 shrink-0">Apply as a company driver</ButtonLink>
        </div>
      </section>
      <Section index="01" label="What's coming" title={["Built for owner-operators", "who want consistency."]}>
        <div className="mt-14 grid gap-px bg-white/10 md:grid-cols-2">
          {points.map((pt, i) => (
            <Reveal key={pt.t} delay={i * 0.05} className="bg-ink p-8">
              <span className="label text-white/40">0{i + 1}</span>
              <h2 className="h3 mt-6">{pt.t}</h2>
              <p className="mt-3 text-white/60">{pt.d}</p>
            </Reveal>
          ))}
        </div>
      </Section>
      <Section id="apply" index="02" label="Get notified" title={["Be first when it opens."]} tone="navy"
        intro={`Takes about a minute. We'll reach out from ${company.phone.display} as soon as the program opens.`}>
        <div className="mt-14 max-w-3xl md:ml-[25%]">
          <OwnerOperatorForm locale={lang} paths={{ privacy: p(routes.privacy), sms: p(routes.sms) }} />
        </div>
      </Section>
    </>
  );
}

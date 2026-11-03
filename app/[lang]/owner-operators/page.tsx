import { resolveLocale, localePath } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { routes } from "@/content/navigation";
import { company, fleet } from "@/content/facts";
import { PageHero } from "@/components/ui/PageHero";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/motion/Reveal";
import { OwnerOperatorForm } from "@/components/forms/OwnerOperatorForm";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";

export async function generateMetadata({ params }: PageProps<"/[lang]/owner-operators">) {
  const lang = await resolveLocale(params);
  return pageMeta(lang, routes.ownerOperators, "Owner-Operator Trucking Jobs — Las Vegas, NV", "Own your truck? Run consistent 53' dry van freight with Global Runners Logistics out of Las Vegas and Henderson, NV. Dispatch that answers 24/7.");
}

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
        label="Owner-operators"
        title={["Your truck.", "Our freight."]}
        intro="Run consistent dry van freight with a Las Vegas fleet that's been hauling since 2012. Tell us about your truck and we'll call you with the details of the program."
      />
      <Section index="01" label="Why run with us" title={["Built for owner-operators", "who want consistency."]}>
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
      <Section id="apply" index="02" label="Tell us about your truck" title={["Get the program details."]} tone="navy"
        intro={`Takes about a minute. We'll call you from ${company.phone.display}.`}>
        <div className="mt-14 max-w-3xl md:ml-[25%]">
          <OwnerOperatorForm locale={lang} paths={{ privacy: p(routes.privacy), sms: p(routes.sms) }} />
        </div>
      </Section>
    </>
  );
}

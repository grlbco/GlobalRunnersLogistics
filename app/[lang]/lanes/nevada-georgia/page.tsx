import { resolveLocale, localePath } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { routes } from "@/content/navigation";
import { fleet } from "@/content/facts";
import { PageHero } from "@/components/ui/PageHero";
import { Section } from "@/components/ui/Section";
import { LaneMap } from "@/components/sections/LaneMap";
import { CtaBand } from "@/components/sections/CtaBand";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";

export async function generateMetadata({ params }: PageProps<"/[lang]/lanes/nevada-georgia">) {
  const lang = await resolveLocale(params);
  return pageMeta(lang, "/lanes/nevada-georgia", "Nevada to Georgia Dry Van Lane — CDL-A Jobs", "Run the Nevada ↔ Georgia 53' dry van lane with Global Runners Logistics. Consistent electronics freight, drop & hook and live loads, out of Henderson, NV.");
}

export default async function LanePage({ params }: PageProps<"/[lang]/lanes/nevada-georgia">) {
  const lang = await resolveLocale(params);
  const p = (path: string) => localePath(lang, path);
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Nevada ↔ Georgia", path: "/lanes/nevada-georgia" }])} />
      <PageHero
        crumbs={[{ name: "Home", href: p("/") }, { name: "Drive", href: p(routes.drive) }, { name: "Nevada ↔ Georgia", href: p("/lanes/nevada-georgia") }]}
        label="Main lane"
        title={["Nevada ↔ Georgia."]}
        intro={`Our main lane runs from the Henderson, NV yard to Georgia and back — ${fleet.trailer}, mostly ${fleet.freight.toLowerCase()}, with ${fleet.loading.join(" and ").toLowerCase()}. It's the backbone of the consistent runs our drivers stay for.`}
      />
      <Section index="01" label="The run" title={["Consistent freight,", "both directions."]}>
        <LaneMap />
      </Section>
      <CtaBand lang={lang} title="Run this lane." />
    </>
  );
}

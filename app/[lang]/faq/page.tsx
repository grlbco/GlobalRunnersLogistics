import { resolveLocale, localePath } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { routes } from "@/content/navigation";
import { faqs, type Faq } from "@/content/faq";
import { PageHero } from "@/components/ui/PageHero";
import { Section } from "@/components/ui/Section";
import { FaqList } from "@/components/ui/Faq";
import { CtaBand } from "@/components/sections/CtaBand";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";

export async function generateMetadata({ params }: PageProps<"/[lang]/faq">) {
  const lang = await resolveLocale(params);
  return pageMeta(lang, routes.faq, "Driver FAQ — Pay, Requirements, Trucks & Home Time", "Answers to the questions CDL-A drivers ask Global Runners Logistics most: weekly pay, requirements, automatic trucks, riders and pets, orientation and more.");
}

const groups: Faq["group"][] = ["Pay", "Hiring", "Equipment", "Life on the road", "Company"];

export default async function FaqPage({ params }: PageProps<"/[lang]/faq">) {
  const lang = await resolveLocale(params);
  const p = (path: string) => localePath(lang, path);
  return (
    <>
      <JsonLd data={[faqSchema(faqs), breadcrumbSchema([{ name: "Home", path: "/" }, { name: "FAQ", path: routes.faq }])]} />
      <PageHero
        crumbs={[{ name: "Home", href: p("/") }, { name: "FAQ", href: p(routes.faq) }]}
        label="Frequently asked questions"
        title={["Straight answers", "for drivers."]}
        intro="Can't find yours? Call us — a real person picks up."
      />
      {groups.map((g, i) => (
        <Section key={g} index={`0${i + 1}`} label={g} tone={i % 2 ? "navy" : "dark"} className="!py-16 md:!py-24">
          <div className="mt-8 md:ml-[25%] md:-mt-6">
            <FaqList items={faqs.filter((f) => f.group === g)} />
          </div>
        </Section>
      ))}
      <CtaBand lang={lang} />
    </>
  );
}

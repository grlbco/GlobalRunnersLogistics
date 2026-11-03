import Link from "next/link";
import { resolveLocale, localePath } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { guides } from "@/content/guides";
import { PageHero } from "@/components/ui/PageHero";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/motion/Reveal";
import { Arrow } from "@/components/ui/Button";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, webPageSchema } from "@/lib/schema";

export async function generateMetadata({ params }: PageProps<"/[lang]/guides">) {
  const lang = await resolveLocale(params);
  return pageMeta(lang, "/guides", "Driver Guides — Pay, Orientation, Team vs. Solo", "Straight answers for CDL-A drivers: how weekly pay works, what to expect at orientation, team vs. solo driving, drop and hook vs. live unload.");
}

export default async function GuidesPage({ params }: PageProps<"/[lang]/guides">) {
  const lang = await resolveLocale(params);
  const p = (path: string) => localePath(lang, path);
  return (
    <>
      <JsonLd data={[webPageSchema({ path: "/guides", name: "Driver guides", description: "Guides for CDL-A drivers from Global Runners Logistics." }), breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }])]} />
      <PageHero crumbs={[{ name: "Home", href: p("/") }, { name: "Guides", href: p("/guides") }]} label="Driver guides" title={["Know before", "you roll."]} intro="Short, straight answers to the questions drivers ask us most." />
      <Section>
        <ul className="grid gap-px bg-white/10 md:grid-cols-2">
          {guides.map((g, i) => (
            <Reveal as="li" key={g.slug} delay={(i % 2) * 0.06} className="bg-ink">
              <Link href={p(`/guides/${g.slug}`)} className="group flex h-full flex-col justify-between gap-10 p-8 transition-colors hover:bg-navy">
                <span className="label text-white/45">0{i + 1} · {g.readMinutes} min read</span>
                <span>
                  <span className="h3 block">{g.title}</span>
                  <span className="mt-3 block text-white/60">{g.description}</span>
                  <span className="mt-6 inline-flex items-center gap-2 font-medium">Read <Arrow className="transition-transform group-hover:translate-x-1" /></span>
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </Section>
    </>
  );
}

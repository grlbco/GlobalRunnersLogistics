import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveLocale, localePath, locales } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { routes } from "@/content/navigation";
import { getGuide, guides } from "@/content/guides";
import { PageHero } from "@/components/ui/PageHero";
import { FaqList } from "@/components/ui/Faq";
import { CtaBand } from "@/components/sections/CtaBand";
import { Arrow } from "@/components/ui/Button";
import { JsonLd } from "@/components/seo/JsonLd";
import { articleSchema, breadcrumbSchema, faqSchema } from "@/lib/schema";

export function generateStaticParams() {
  return locales.flatMap((lang) => guides.map((g) => ({ lang, slug: g.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/guides/[slug]">) {
  const lang = await resolveLocale(params);
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) return {};
  return pageMeta(lang, `/guides/${g.slug}`, g.title, g.description);
}

export default async function GuidePage({ params }: PageProps<"/[lang]/guides/[slug]">) {
  const lang = await resolveLocale(params);
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();
  const p = (path: string) => localePath(lang, path);
  const others = guides.filter((x) => x.slug !== g.slug).slice(0, 3);
  return (
    <>
      <JsonLd data={[articleSchema(g), faqSchema(g.faq), breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }, { name: g.title, path: `/guides/${g.slug}` }])]} />
      <PageHero crumbs={[{ name: "Home", href: p("/") }, { name: "Guides", href: p("/guides") }, { name: g.title, href: p(`/guides/${g.slug}`) }]} label={`Guide · ${g.readMinutes} min read · Updated ${g.updated}`} title={[g.title]} />
      <article className="py-16 md:py-24">
        <div className="container-site grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-7 lg:col-start-4">
            <p className="border-l-2 border-signal pl-5 text-xl leading-relaxed text-white/90 md:text-2xl">{g.answer}</p>
            {g.blocks.map((b) => (
              <section key={b.h2} className="mt-12">
                <h2 className="h3">{b.h2}</h2>
                {b.p?.map((para, i) => (
                  <p key={i} className="body-lg mt-4 text-white/70">{para}</p>
                ))}
                {b.list && (
                  <ul className="mt-5 space-y-3">
                    {b.list.map((li) => (
                      <li key={li} className="flex gap-4 text-lg text-white/80">
                        <span className="mt-2.5 h-1.5 w-1.5 shrink-0 bg-signal" />
                        {li}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
            <section className="mt-16">
              <h2 className="h3">Questions</h2>
              <div className="mt-6"><FaqList items={g.faq} /></div>
            </section>
            <p className="mt-12 text-sm text-white/45">Published {g.published} · Updated {g.updated} · By Global Runners Logistics LLC, Las Vegas, NV</p>
            <div className="mt-12 border-t border-white/10 pt-8">
              <p className="label text-white/45">More guides</p>
              <ul className="mt-4 space-y-3">
                {others.map((o) => (
                  <li key={o.slug}><Link href={p(`/guides/${o.slug}`)} className="inline-flex items-center gap-2 text-white/80 hover:text-white">{o.title} <Arrow /></Link></li>
                ))}
                <li><Link href={p(routes.drive)} className="inline-flex items-center gap-2 text-signal">See open CDL-A jobs <Arrow /></Link></li>
              </ul>
            </div>
          </div>
        </div>
      </article>
      <CtaBand lang={lang} />
    </>
  );
}

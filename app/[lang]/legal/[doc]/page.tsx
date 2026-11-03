import { notFound } from "next/navigation";
import { resolveLocale, localePath, locales } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { getLegal, legalDocs } from "@/content/legal";
import { company } from "@/content/facts";

export function generateStaticParams() {
  return locales.flatMap((lang) => legalDocs.map((d) => ({ lang, doc: d.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/legal/[doc]">) {
  const lang = await resolveLocale(params);
  const { doc } = await params;
  const d = getLegal(doc);
  if (!d) return {};
  return pageMeta(lang, `/legal/${d.slug}`, d.title, `${d.title} for ${company.legalName}.`);
}

export default async function LegalPage({ params }: PageProps<"/[lang]/legal/[doc]">) {
  const lang = await resolveLocale(params);
  const { doc } = await params;
  const d = getLegal(doc);
  if (!d) notFound();
  return (
    <article className="pb-28 pt-36 md:pt-48">
      <div className="container-site grid gap-12 lg:grid-cols-12">
        <header className="lg:col-span-4">
          <p className="label text-white/45">Legal</p>
          <h1 className="h2 mt-4">{d.title}</h1>
          <p className="label mt-6 text-white/40">Updated {d.updated}</p>
          <nav className="mt-10 hidden flex-col gap-2 text-white/60 lg:flex">
            {legalDocs.map((x) => (
              <a key={x.slug} href={localePath(lang, `/legal/${x.slug}`)} className={x.slug === d.slug ? "text-white" : "hover:text-white"}>
                {x.title}
              </a>
            ))}
          </nav>
        </header>
        <div className="space-y-10 lg:col-span-7 lg:col-start-6">
          {d.sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-xl font-semibold tracking-[-0.01em]">{s.h}</h2>
              {s.p.map((para, i) => (
                <p key={i} className="mt-3 leading-relaxed text-white/70">
                  {para}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}

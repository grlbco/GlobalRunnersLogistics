import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDictionary } from "@/dictionaries";
import { hasLocale, localePath, locales } from "@/lib/i18n";
import { routes } from "@/content/navigation";
import { Arrow } from "@/components/ui/Button";

/** Temporary placeholders so every nav link resolves while pages are built (Step 6). */
const stubPaths = Object.values(routes)
  .map((r) => r.split("#")[0])
  .filter((r, i, arr) => r !== "/" && arr.indexOf(r) === i);

const titles: Record<string, string> = {
  drive: "Drive with us",
  "team-cdl-a-otr-las-vegas": "Team CDL-A OTR",
  "solo-cdl-a-regional-las-vegas": "Solo CDL-A Regional",
  "owner-operators": "Owner-operators",
  about: "About",
  locations: "Locations",
  contact: "Contact",
  faq: "FAQ",
  driver: "Apply — Company driver",
  "owner-operator": "Apply — Owner-operator",
  login: "Log in",
  privacy: "Privacy policy",
  terms: "Terms",
  "sms-terms": "SMS terms",
  eeo: "Equal opportunity",
};

export function generateStaticParams() {
  return locales.flatMap((lang) => stubPaths.map((path) => ({ lang, slug: path.slice(1).split("/") })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/[...slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: titles[slug.at(-1) ?? ""] ?? "Global Runners Logistics" };
}

export default async function StubPage({ params }: PageProps<"/[lang]/[...slug]">) {
  const { lang, slug } = await params;
  if (!hasLocale(lang) || !stubPaths.includes(`/${slug.join("/")}`)) notFound();
  const dict = await getDictionary(lang);
  const key = slug.at(-1) ?? "";

  return (
    <section className="container-site flex min-h-[80svh] flex-col justify-end pb-24 pt-40">
      <p className="label text-white/40">/{slug.join("/")}</p>
      <h1 className="display mt-6 max-w-[16ch]">{titles[key] ?? key}</h1>
      <p className="body-lg mt-6 text-white/60">{dict.stub.soon}</p>
      <Link href={localePath(lang, "/")} className="mt-10 inline-flex items-center gap-2 text-white/80 hover:text-white">
        <Arrow className="rotate-180" /> {dict.stub.back}
      </Link>
    </section>
  );
}

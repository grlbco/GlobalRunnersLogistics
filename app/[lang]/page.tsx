import { notFound } from "next/navigation";
import { getDictionary } from "@/dictionaries";
import { hasLocale, localePath } from "@/lib/i18n";
import { routes } from "@/content/navigation";
import { Hero } from "@/components/sections/Hero";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <>
      <Hero
        hero={dict.hero}
        proof={dict.proof}
        applyHref={localePath(lang, routes.applyDriver)}
        payHref={localePath(lang, routes.pay)}
      />
      {/* Sections 01–08 (docs/plan/04) land in Step 4. */}
      <section className="container-site py-32">
        <p className="label text-white/40">01 — Why drivers stay</p>
        <p className="h2 mt-6 max-w-3xl text-white/90">
          Pay you can count on. Consistent runs. No wait time. Home on time, not late.
        </p>
      </section>
    </>
  );
}

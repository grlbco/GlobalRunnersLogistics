import Link from "next/link";
import { resolveLocale, localePath } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { routes } from "@/content/navigation";
import { jobs, requirements, whatYouGet } from "@/content/jobs";
import { faqs } from "@/content/faq";
import { company, fleet, pay } from "@/content/facts";
import { PageHero } from "@/components/ui/PageHero";
import { Section } from "@/components/ui/Section";
import { FaqList } from "@/components/ui/Faq";
import { ButtonLink, Arrow } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import { JsonLd } from "@/components/seo/JsonLd";
import { CtaBand } from "@/components/sections/CtaBand";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";

export async function generateMetadata({ params }: PageProps<"/[lang]/drive">) {
  const lang = await resolveLocale(params);
  return pageMeta(
    lang,
    routes.drive,
    "CDL-A Driving Jobs in Las Vegas & Henderson, NV",
    "Company CDL-A jobs for solo and team drivers out of Henderson, NV. 53' dry van, automatic trucks, weekly pay every Thursday, $1,000 anniversary bonus, 24/7 dispatch.",
  );
}

export default async function DrivePage({ params }: PageProps<"/[lang]/drive">) {
  const lang = await resolveLocale(params);
  const p = (path: string) => localePath(lang, path);
  const payFaqs = faqs.filter((f) => f.group === "Pay" || f.group === "Life on the road").slice(0, 7);

  return (
    <>
      <JsonLd data={[breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Drive", path: routes.drive }]), faqSchema(payFaqs)]} />
      <PageHero
        crumbs={[{ name: "Home", href: p("/") }, { name: "Drive", href: p(routes.drive) }]}
        label="Company drivers · CDL-A"
        title={["Drive for a fleet", "that keeps you moving."]}
        intro={`Global Runners Logistics hires CDL-A solo and team drivers out of ${company.yard.city}, Nevada. ${fleet.trailer}, automatic trucks, weekly pay every ${pay.payday}, and a dispatcher who gets you home on time.`}
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={p(routes.applyDriver)} arrow className="h-14 px-7">Apply now</ButtonLink>
          <ButtonLink href="#requirements" variant="outline" className="h-14 px-7">Requirements</ButtonLink>
        </div>
      </PageHero>

      <Section index="01" label="Open positions" title={["Three ways to drive", "with us."]}>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {jobs.map((j, i) => (
            <Reveal key={j.slug} delay={i * 0.06}>
              <Link
                href={p(`/drive/${j.slug}`)}
                className="group flex h-full min-h-80 flex-col justify-between bg-navy p-7 transition-colors hover:bg-steel"
                style={{ clipPath: "polygon(0 0, calc(100% - 36px) 0, 100% 36px, 100% 100%, 0 100%)" }}
              >
                <span className="label text-white/45">0{i + 1}</span>
                <div>
                  <p className="label text-signal">{j.driverType} · {j.runType}</p>
                  <h2 className="h3 mt-3">{j.title.split(" — ")[0]}</h2>
                  <p className="mt-2 text-white/60">{j.route}</p>
                  <span className="mt-6 inline-flex items-center gap-2 font-medium">
                    View job <Arrow className="transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section id="pay" index="02" label="Pay & home time" title={["What you get."]} tone="navy"
        intro="Your per-mile rate is confirmed on your first call with our recruiter — before you commit to anything.">
        <ul className="mt-14 grid gap-px bg-white/10 sm:grid-cols-2">
          {whatYouGet.map((w, i) => (
            <Reveal as="li" key={w} delay={(i % 4) * 0.04} className="flex items-start gap-4 bg-navy p-6">
              <span className="label mt-1 text-signal">0{i + 1 < 10 ? i + 1 : ""}{i + 1 >= 10 ? i + 1 : ""}</span>
              <span className="text-lg">{w}</span>
            </Reveal>
          ))}
        </ul>
      </Section>

      <Section id="requirements" index="03" label="Requirements" title={["What you need", "to apply."]}>
        <ol className="mt-14 border-t border-white/15 md:ml-[25%]">
          {requirements.map((r, i) => (
            <Reveal as="li" key={r} delay={i * 0.03} className="grid grid-cols-12 gap-4 border-b border-white/15 py-5">
              <span className="label col-span-2 text-white/40">0{i + 1}</span>
              <span className="col-span-10 text-lg md:text-xl">{r}</span>
            </Reveal>
          ))}
        </ol>
        <p className="mt-8 text-sm text-white/50 md:ml-[25%]">
          Global Runners Logistics LLC is an equal opportunity employer. <Link href={p(routes.eeo)} className="underline underline-offset-2">Read our EEO statement</Link>.
        </p>
      </Section>

      <Section index="04" label="Questions" title={["Pay and life on the road."]} tone="navy">
        <div className="mt-14 md:ml-[25%]">
          <FaqList items={payFaqs} />
        </div>
      </Section>

      <CtaBand lang={lang} />
    </>
  );
}

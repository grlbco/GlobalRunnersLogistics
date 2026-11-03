import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/dictionaries";
import { hasLocale, localePath } from "@/lib/i18n";
import { routes } from "@/content/navigation";
import { company, fleet } from "@/content/facts";
import { jobs } from "@/content/jobs";
import { homeFaqs } from "@/content/faq";
import { Hero } from "@/components/sections/Hero";
import { LaneMap } from "@/components/sections/LaneMap";
import { JobsRail } from "@/components/sections/JobsRail";
import { Section } from "@/components/ui/Section";
import { FaqList } from "@/components/ui/Faq";
import { ButtonLink, Arrow } from "@/components/ui/Button";
import { Reveal, RevealLines, Counter } from "@/components/motion/Reveal";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationSchema, websiteSchema, faqSchema } from "@/lib/schema";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const h = dict.home;
  const p = (path: string) => localePath(lang, path);

  return (
    <>
      <JsonLd data={[organizationSchema(), websiteSchema(), faqSchema(homeFaqs)]} />
      <Hero hero={dict.hero} proof={dict.proof} applyHref={p(routes.applyDriver)} payHref={p(routes.pay)} />

      {/* 01 — Why drivers stay */}
      <Section index="01" label={h.stay.label} title={h.stay.title} intro={h.stay.intro}>
        <ol className="mt-16 border-t border-white/15 md:mt-24">
          {h.stay.items.map((item, i) => (
            <Reveal as="li" key={item.t} delay={i * 0.05} className="group border-b border-white/15">
              <div className="grid grid-cols-12 items-baseline gap-4 py-8 transition-colors duration-500 md:py-10">
                <span className="label col-span-2 text-white/40 md:col-span-3">0{i + 1}</span>
                <h3 className="col-span-10 text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] transition-transform duration-500 ease-house group-hover:translate-x-2 md:col-span-4 md:text-[2.5rem]">
                  {item.t}
                </h3>
                <p className="col-span-10 col-start-3 text-white/60 md:col-span-5 md:col-start-auto body-lg">{item.d}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </Section>

      {/* 02 — Pay */}
      <Section id="pay" index="02" label={h.pay.label} title={h.pay.title} intro={h.pay.intro} tone="navy">
        <div className="mt-16 grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4 md:mt-24">
          {h.pay.stats.map((s, i) => (
            <Reveal key={s.k} delay={i * 0.06} className="flex min-h-56 flex-col justify-between bg-navy p-7">
              <span className="label text-white/40">0{i + 1}</span>
              <div>
                <Counter to={s.n} prefix={s.prefix} suffix={s.suffix} className="display block text-white" />
                <p className="mt-3 text-white/60">{s.k}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href={p(routes.applyDriver)} arrow>
            {dict.nav.apply}
          </ButtonLink>
          <ButtonLink href={p(routes.drive)} variant="outline">
            {dict.footer.links.requirements}
          </ButtonLink>
        </Reveal>
      </Section>

      {/* 03 — Equipment (light section for rhythm) */}
      <Section index="03" label={h.equipment.label} title={h.equipment.title} intro={h.equipment.intro} tone="light">
        <div className="mt-16 grid grid-cols-1 gap-12 md:mt-24 lg:grid-cols-12">
          <div className="flex gap-10 lg:col-span-4 lg:flex-col">
            <Reveal>
              <Counter to={fleet.trucks} className="block text-[5.5rem] font-semibold leading-none tracking-[-0.05em] md:text-[8rem]" />
              <p className="label mt-3 text-ink/50">{h.equipment.fleet}</p>
            </Reveal>
            <Reveal delay={0.1}>
              <Counter to={company.foundedYear} grouping={false} className="block text-[5.5rem] font-semibold leading-none tracking-[-0.05em] md:text-[8rem]" />
              <p className="label mt-3 text-ink/50">{h.equipment.since}</p>
            </Reveal>
          </div>
          <dl className="border-t border-ink/15 lg:col-span-8">
            {h.equipment.specs.map((s, i) => (
              <Reveal key={s.k} delay={i * 0.04} className="grid grid-cols-12 gap-4 border-b border-ink/15 py-6">
                <dt className="label col-span-12 text-ink/50 sm:col-span-4">{s.k}</dt>
                <dd className="col-span-12 text-xl font-medium tracking-[-0.02em] sm:col-span-8 md:text-2xl">{s.v}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </Section>

      {/* 04 — Lane */}
      <Section index="04" label={h.lane.label} title={h.lane.title} intro={h.lane.intro}>
        <LaneMap />
      </Section>

      {/* 05 — Jobs */}
      <Section index="05" label={h.jobs.label} title={h.jobs.title} intro={h.jobs.intro} tone="navy" className="overflow-hidden">
        <JobsRail
          cards={jobs.map((j, i) => ({
            href: p(`/drive/${j.slug}`),
            index: `0${i + 1}`,
            title: j.title.replace(" — ", " · ").replace("Truck Driver", "Driver"),
            meta: `${j.driverType} · ${j.runType}`,
            summary: j.route,
          }))}
          cta={{ href: p(routes.applyDriver), label: h.jobs.cta }}
        />
      </Section>

      {/* 06 — How hiring works */}
      <Section index="06" label={h.steps.label} title={h.steps.title}>
        <ol className="mt-16 grid grid-cols-1 gap-px bg-white/10 md:mt-24 md:grid-cols-2 lg:grid-cols-4">
          {h.steps.items.map((s, i) => (
            <Reveal as="li" key={s.t} delay={i * 0.08} className="relative flex min-h-72 flex-col justify-between bg-ink p-7">
              <span className="text-[4rem] font-semibold leading-none tracking-[-0.05em] text-white/15">0{i + 1}</span>
              <div>
                <h3 className="h3">{s.t}</h3>
                <p className="mt-3 text-white/60">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </Section>

      {/* 07 — Owner-operators */}
      <section className="relative overflow-hidden border-y border-white/10 bg-ink">
        <div className="container-site grid grid-cols-1 gap-10 py-24 md:grid-cols-12 md:py-32">
          <Reveal className="md:col-span-3">
            <p className="label text-white/45">07 — {h.owners.label}</p>
          </Reveal>
          <div className="md:col-span-6">
            <RevealLines lines={h.owners.title} className="display block" />
            <Reveal delay={0.15}>
              <p className="body-lg mt-6 max-w-xl text-white/65">{h.owners.intro}</p>
            </Reveal>
          </div>
          <Reveal delay={0.2} className="flex items-end md:col-span-3 md:justify-end">
            <ButtonLink href={p(routes.ownerOperators)} variant="outline" arrow className="h-14">
              {h.owners.cta}
            </ButtonLink>
          </Reveal>
        </div>
      </section>

      {/* 08 — FAQ */}
      <Section index="08" label={h.faq.label} title={h.faq.title}>
        <div className="mt-14 md:ml-[25%]">
          <FaqList items={homeFaqs} />
          <Link href={p(routes.faq)} className="mt-8 inline-flex items-center gap-2 text-white/80 hover:text-white">
            {h.faq.more} <Arrow />
          </Link>
        </div>
      </Section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-signal">
        <div className="container-site flex flex-col gap-10 py-24 md:flex-row md:items-end md:justify-between md:py-32">
          <div>
            <RevealLines lines={h.final.title} className="display-xl block" />
            <p className="body-lg mt-6 max-w-md text-white/85">{h.final.sub}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={p(routes.applyDriver)} arrow className="h-14 bg-white px-8 text-ink hover:text-white">
              {dict.nav.apply}
            </ButtonLink>
            <ButtonLink href={`tel:${company.phone.e164}`} variant="outline" className="h-14 border-white/50 px-8">
              {h.final.call} {company.phone.display}
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

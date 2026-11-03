import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveLocale, localePath, locales } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { routes } from "@/content/navigation";
import { getJob, jobs, requirements, whatYouGet } from "@/content/jobs";
import { company, hiring } from "@/content/facts";
import { PageHero } from "@/components/ui/PageHero";
import { ButtonLink, Arrow } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import { JsonLd } from "@/components/seo/JsonLd";
import { CtaBand } from "@/components/sections/CtaBand";
import { breadcrumbSchema, jobPostingSchema } from "@/lib/schema";

export function generateStaticParams() {
  return locales.flatMap((lang) => jobs.map((j) => ({ lang, job: j.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/drive/[job]">) {
  const lang = await resolveLocale(params);
  const { job: slug } = await params;
  const job = getJob(slug);
  if (!job) return {};
  return pageMeta(lang, `/drive/${job.slug}`, `${job.title} — Henderson, NV`, job.summary.slice(0, 155));
}

export default async function JobPage({ params }: PageProps<"/[lang]/drive/[job]">) {
  const lang = await resolveLocale(params);
  const { job: slug } = await params;
  const job = getJob(slug);
  if (!job) notFound();
  const p = (path: string) => localePath(lang, path);

  const descriptionHtml = [
    `<p>${job.summary}</p>`,
    `<h3>What you get</h3><ul>${whatYouGet.map((w) => `<li>${w}</li>`).join("")}</ul>`,
    `<h3>Requirements</h3><ul>${requirements.map((r) => `<li>${r}</li>`).join("")}</ul>`,
    `<p>Apply online at ${company.url}/apply/driver or call ${company.phone.display}.</p>`,
  ].join("");

  return (
    <>
      <JsonLd
        data={[
          jobPostingSchema(job, descriptionHtml),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Drive", path: routes.drive },
            { name: job.short, path: `/drive/${job.slug}` },
          ]),
        ]}
      />
      <PageHero
        crumbs={[{ name: "Home", href: p("/") }, { name: "Drive", href: p(routes.drive) }, { name: job.short, href: p(`/drive/${job.slug}`) }]}
        label={`Now hiring · ${job.driverType} · ${job.runType}`}
        title={job.title.split(" — ")}
        intro={job.summary}
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={p(routes.applyDriver)} arrow className="h-14 px-7">Apply for this job</ButtonLink>
          <ButtonLink href={`tel:${company.phone.e164}`} variant="outline" className="h-14 px-7">Call {company.phone.display}</ButtonLink>
        </div>
      </PageHero>

      <section className="py-20 md:py-28">
        <div className="container-site grid gap-16 lg:grid-cols-12">
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <p className="label text-white/45">Job details</p>
              <dl className="mt-6 border-t border-white/15">
                {job.highlights.map((h) => (
                  <div key={h.k} className="grid grid-cols-5 gap-3 border-b border-white/15 py-4">
                    <dt className="label col-span-2 pt-1 text-white/45">{h.k}</dt>
                    <dd className="col-span-3">{h.v}</dd>
                  </div>
                ))}
                <div className="grid grid-cols-5 gap-3 border-b border-white/15 py-4">
                  <dt className="label col-span-2 pt-1 text-white/45">Location</dt>
                  <dd className="col-span-3">{hiring.pickup}</dd>
                </div>
              </dl>
            </div>
          </aside>
          <div className="space-y-16 lg:col-span-8">
            <Reveal>
              <h2 className="h2">What you get</h2>
              <ul className="mt-8 space-y-4">
                {whatYouGet.map((w) => (
                  <li key={w} className="flex gap-4 text-lg text-white/85">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 bg-signal" />
                    {w}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal>
              <h2 className="h2">Requirements</h2>
              <ul className="mt-8 space-y-4">
                {requirements.map((r) => (
                  <li key={r} className="flex gap-4 text-lg text-white/85">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 bg-white/50" />
                    {r}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal>
              <h2 className="h2">How to apply</h2>
              <p className="body-lg mt-6 text-white/70">
                Fill out the 2-minute application. Ken will call you back — usually within the hour during office hours (Pacific Time). After that you finish your full DOT application online,
                come to a {hiring.orientationDays}-day orientation in Henderson, and take your first load in about two weeks.
              </p>
              <Link href={p(routes.applyDriver)} className="mt-8 inline-flex items-center gap-2 text-lg font-medium text-signal hover:text-white">
                Start the application <Arrow />
              </Link>
            </Reveal>
            <p className="text-sm text-white/45">
              Global Runners Logistics LLC is an equal opportunity employer. Posted {job.datePosted}.
            </p>
          </div>
        </div>
      </section>
      <CtaBand lang={lang} />
    </>
  );
}

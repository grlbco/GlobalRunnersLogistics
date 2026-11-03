import { resolveLocale, localePath } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { routes } from "@/content/navigation";
import { company } from "@/content/facts";
import { PageHero } from "@/components/ui/PageHero";
import { ContactForm } from "@/components/forms/ContactForm";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, localBusinessSchema } from "@/lib/schema";

export async function generateMetadata({ params }: PageProps<"/[lang]/contact">) {
  const lang = await resolveLocale(params);
  return pageMeta(lang, routes.contact, "Contact Global Runners Logistics — Las Vegas, NV", `Call ${company.phone.display} or send us a message. Office at ${company.office.street}, ${company.office.city}, NV.`);
}

export default async function ContactPage({ params }: PageProps<"/[lang]/contact">) {
  const lang = await resolveLocale(params);
  const p = (path: string) => localePath(lang, path);
  return (
    <>
      <JsonLd data={[localBusinessSchema(), breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Contact", path: routes.contact }])]} />
      <PageHero crumbs={[{ name: "Home", href: p("/") }, { name: "Contact", href: p(routes.contact) }]} label="Contact" title={["Talk to a real person."]} />
      <section className="py-20 md:py-28">
        <div className="container-site grid gap-16 lg:grid-cols-12">
          <div className="space-y-10 lg:col-span-4">
            <div>
              <p className="label text-white/45">Call</p>
              <a href={`tel:${company.phone.e164}`} className="mt-3 block text-3xl font-semibold tracking-[-0.02em] hover:text-signal md:text-4xl">
                {company.phone.display}
              </a>
              <p className="mt-2 text-white/55">{company.owner} · {company.timeZone}</p>
            </div>
            <div>
              <p className="label text-white/45">Office</p>
              <address className="mt-3 text-lg not-italic leading-relaxed">
                {company.legalName}
                <br />
                {company.office.street}
                <br />
                {company.office.city}, {company.office.region} {company.office.postalCode}
              </address>
            </div>
            <div>
              <p className="label text-white/45">Truck yard</p>
              <p className="mt-3 text-lg">{company.yard.city}, {company.yard.region}</p>
            </div>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <ContactForm locale={lang} paths={{ privacy: p(routes.privacy), sms: p(routes.sms) }} />
          </div>
        </div>
      </section>
    </>
  );
}

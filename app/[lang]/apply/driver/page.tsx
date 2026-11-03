import { resolveLocale, localePath } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { routes } from "@/content/navigation";
import { company } from "@/content/facts";
import { Suspense } from "react";
import { DriverApplyForm } from "@/components/forms/DriverApplyForm";
import { prefillForToken } from "@/lib/crm/forms";

export async function generateMetadata({ params }: PageProps<"/[lang]/apply/driver">) {
  const lang = await resolveLocale(params);
  return pageMeta(
    lang,
    routes.applyDriver,
    lang === "es" ? "Aplica — Chofer CDL-A" : "Apply — CDL-A Company Driver",
    "Apply in 2 minutes to drive CDL-A for Global Runners Logistics out of Henderson, NV. A real person calls you back.",
    { translated: true },
  );
}

export default async function ApplyDriverPage({ params, searchParams }: PageProps<"/[lang]/apply/driver">) {
  const lang = await resolveLocale(params);
  const p = (path: string) => localePath(lang, path);
  const es = lang === "es";
  const paths = { register: p("/register"), home: p("/"), privacy: p(routes.privacy), sms: p(routes.sms) };
  return (
    <section className="min-h-svh pb-24 pt-32 md:pt-40">
      <div className="container-site grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="label flex items-center gap-3 text-white/60">
            <span className="h-2 w-2 rounded-full bg-signal" />
            {es ? "Aplicación · 2 minutos" : "Application · 2 minutes"}
          </p>
          <h1 className="display mt-6">{es ? "Vamos a ponerte en ruta." : "Let's get you rolling."}</h1>
          <p className="body-lg mt-6 text-white/65">
            {es
              ? "Preguntas cortas, respuestas de un toque. Sin SSN ni documentos todavía."
              : "Short questions, tap-to-answer. No SSN or documents yet."}
          </p>
          <p className="mt-8 text-white/55">
            {es ? "¿Prefieres llamar?" : "Rather call?"}{" "}
            <a href={`tel:${company.phone.e164}`} className="text-white underline underline-offset-4">
              {company.phone.display}
            </a>
          </p>
        </div>
        <div className="lg:col-span-7 lg:col-start-6">
          <Suspense fallback={<DriverApplyForm locale={lang} paths={paths} />}>
            <PersonalForm lang={lang} paths={paths} searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

/** `?t=<token>` = personal link from the CRM: prefill and track progress. */
async function PersonalForm({ lang, paths, searchParams }: { lang: "en" | "es"; paths: { register: string; home: string; privacy: string; sms: string }; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" && /^[0-9a-f]{24}$/.test(sp.t) ? sp.t : undefined;
  const prefill = token ? await prefillForToken(token).catch(() => null) : null;
  return <DriverApplyForm locale={lang} paths={paths} token={prefill ? token : undefined} prefill={prefill} />;
}

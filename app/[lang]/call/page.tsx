import { Suspense } from "react";
import { company } from "@/content/facts";
import { CallPageClient } from "./client";

export const metadata = { title: "Talk to our team", robots: { index: false, follow: false } };

/** /call?t=<token>: the link the assistant can send. One tap, our team calls. */
export default async function CallPage({ params }: { params: Promise<{ lang: string }> }) {
  const es = (await params).lang === "es";
  return (
    <section className="min-h-svh pb-24 pt-24 md:pt-40">
      <div className="container-site max-w-xl">
        <h1 className="display text-[clamp(2rem,6vw,3.25rem)]">{es ? "Habla con nuestro equipo." : "Talk to our team."}</h1>
        <p className="body-lg mt-4 text-white/65">{es ? "En Global Runners Logistics hablas con una persona de verdad, no con un call center. Toca abajo y nuestro equipo recibe un aviso para llamarte." : "At Global Runners Logistics you talk to a real person, not a call center. Tap below and our team gets an alert to call you."}</p>
        <div className="mt-10">
          <Suspense fallback={<div className="h-40 animate-pulse rounded-[6px] bg-white/[0.04]" />}>
            <CallPageClient locale={es ? "es" : "en"} />
          </Suspense>
        </div>
        <p className="mt-8 text-white/55">{es ? "O llámanos ahora:" : "Or call us now:"} <a href={`tel:${company.phone.e164}`} className="text-white underline underline-offset-4">{company.phone.vanity} · {company.phone.display}</a></p>
      </div>
    </section>
  );
}

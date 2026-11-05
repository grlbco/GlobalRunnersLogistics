import { notFound } from "next/navigation";
import { Suspense } from "react";
import { adminDb } from "@/lib/crm/admin";
import { prefillForToken } from "@/lib/crm/forms";
import { allFields, type Answers, type FormSchema } from "@/lib/formbuilder/schema";
import { PublicForm } from "@/components/forms/PublicForm";
import { company } from "@/content/facts";

export const metadata = { title: "Global Runners Logistics", robots: { index: false, follow: false } };

/** Public form from the Forms module: /f/<slug>, optional ?t=<personal token> to prefill and link to the driver. */
export default function FormPage({ params, searchParams }: { params: Promise<{ lang: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <section className="min-h-svh pb-24 pt-32 md:pt-40">
      <div className="container-site max-w-2xl">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-[6px] bg-white/[0.04]" />}>
          <Body params={params} searchParams={searchParams} />
        </Suspense>
      </div>
    </section>
  );
}

async function Body({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,61}$/.test(slug)) notFound();
  const { data: form } = await adminDb().from("crm_forms").select("slug, status, schema").eq("slug", slug).maybeSingle();
  if (!form || form.status === "draft") notFound();
  const schema = form.schema as FormSchema;
  const sp = await searchParams;
  const token = typeof sp.t === "string" && /^[0-9a-f]{24}$/.test(sp.t) ? sp.t : null;
  let prefill: Answers | undefined;
  if (token) {
    const p = await prefillForToken(token).catch(() => null);
    if (p) {
      prefill = {};
      for (const f of allFields(schema)) {
        if (f.map === "first_name" && p.first_name) prefill[f.id] = p.first_name;
        if (f.map === "last_name" && p.last_name) prefill[f.id] = p.last_name;
        if (f.map === "full_name" && p.first_name) prefill[f.id] = [p.first_name, p.last_name].filter(Boolean).join(" ");
        if (f.map === "cell_phone" && p.phone) prefill[f.id] = p.phone;
        if (f.map === "email" && p.email) prefill[f.id] = p.email;
      }
    }
  }
  return (
    <>
      {schema.settings.title && <h1 className="display text-[clamp(2rem,6vw,3.5rem)]">{schema.settings.title}</h1>}
      {schema.settings.description && <p className="body-lg mt-5 text-white/65">{schema.settings.description}</p>}
      <div className="mt-12">
        {form.status === "closed" ? <p className="text-white/60">This form is closed. Call us at {company.phone.display}.</p> : <PublicForm slug={form.slug} schema={schema} token={token} prefill={prefill} />}
      </div>
    </>
  );
}

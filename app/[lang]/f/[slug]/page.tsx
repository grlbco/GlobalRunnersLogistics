import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPublicForm } from "@/lib/formbuilder/public";
import { PublicForm } from "@/components/forms/PublicForm";
import { company } from "@/content/facts";

export const metadata = { title: "Driver form", robots: { index: false, follow: false } };

/**
 * Public form from the Forms module: /f/<slug>.
 * The form comes from cache (instant open); a personal ?t=<token> link is read in the browser and
 * prefilled after first paint, so it never slows the page down.
 */
export default function FormPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  return (
    <section className="min-h-svh pb-24 pt-24 md:pt-40">
      <div className="container-site max-w-2xl">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-[6px] bg-white/[0.04]" />}>
          <Body params={params} />
        </Suspense>
      </div>
    </section>
  );
}

async function Body({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,61}$/.test(slug)) notFound();
  const form = await getPublicForm(slug);
  if (!form || form.status === "draft") notFound();
  const s = form.schema.settings;
  return (
    <>
      {s.title && <h1 className="display text-[clamp(2rem,6vw,3.5rem)]">{s.title}</h1>}
      {s.description && <p className="body-lg mt-4 text-white/65">{s.description}</p>}
      <div className="mt-10">
        {form.status === "closed" ? <p className="text-white/60">This form is closed. Call us at {company.phone.display}.</p> : <PublicForm slug={form.slug} schema={form.schema} />}
      </div>
    </>
  );
}

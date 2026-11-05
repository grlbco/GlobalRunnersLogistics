import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { clsx } from "clsx";
import { requireStaff } from "@/lib/crm/auth";
import { ago, fullName } from "@/lib/crm/format";
import { siteUrl } from "@/lib/site";
import { allFields, type Answers, type FormSchema, type OnSubmit } from "@/lib/formbuilder/schema";
import { Card, Skeleton, StageBadge, btnGhostCls } from "@/components/crm/ui";
import { FormEditor } from "@/components/crm/FormEditor";
import { deleteForm } from "../actions";

export default function FormPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton className="h-[70vh]" /></div>}>
      <Body params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "build" } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, staff } = await requireStaff(`/crm/forms/${id}`, "forms.view");
  const [{ data: form }, { count }] = await Promise.all([
    supabase.from("crm_forms").select("id, name, slug, status, schema, on_submit").eq("id", id).maybeSingle(),
    supabase.from("crm_form_submissions").select("*", { count: "exact", head: true }).eq("form_id", id),
  ]);
  if (!form) notFound();
  return (
    <div className="px-5 md:px-6">
      <Link href="/crm/forms" className="inline-flex items-center gap-1 text-[0.78rem] text-muted transition-colors hover:text-fg">← Forms</Link>
      <div className="mt-4 mb-5 flex gap-1 border-b border-line">
        {[["build", "Build"], ["submissions", `Submissions (${count ?? 0})`]].map(([k, l]) => (
          <Link key={k} href={`/crm/forms/${id}?tab=${k}`} className={clsx("-mb-px border-b-2 px-4 py-2.5 text-sm", tab === k ? "border-signal text-fg" : "border-transparent text-faint hover:text-fg")}>{l}</Link>
        ))}
      </div>
      {tab === "submissions" ? (
        <Submissions id={id} schema={form.schema as FormSchema} />
      ) : (
        <>
          <FormEditor initial={{ id: form.id, name: form.name, slug: form.slug, status: form.status as "draft" | "published" | "closed", schema: form.schema as FormSchema, on_submit: (form.on_submit ?? {}) as OnSubmit }} siteUrl={siteUrl()} />
          {staff.can("forms.manage") && (
            <form action={deleteForm} className="mt-8">
              <input type="hidden" name="id" value={form.id} />
              <button className="text-xs text-red-600 hover:text-red-600">Delete this form and its submissions</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

async function Submissions({ id, schema }: { id: string; schema: FormSchema }) {
  const { supabase } = await requireStaff(`/crm/forms/${id}?tab=submissions`, "forms.view");
  const { data: subs } = await supabase
    .from("crm_form_submissions")
    .select("id, data, created_at, contact:contacts(id, first_name, last_name, company_name, stage)")
    .eq("form_id", id)
    .order("created_at", { ascending: false })
    .limit(200);
  const cols = allFields(schema).filter((f) => f.type !== "statement");
  const show = (v: Answers[string]) => (v === true ? "Yes" : v === false ? "No" : Array.isArray(v) ? v.join(", ") : v == null || v === "" ? "—" : String(v));
  if (!subs?.length) return <p className="text-sm text-faint">No submissions yet. Publish the form and share the link.</p>;
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><a href={`/crm/forms/${id}/export`} className={btnGhostCls}>Export CSV</a></div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-faint">
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Driver</th>
              {cols.slice(0, 6).map((c) => <th key={c.id} className="max-w-48 truncate px-4 py-3 font-medium">{c.type === "consent" ? "Text consent" : c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {subs.map((s) => {
              const c = s.contact as unknown as { id: string; first_name: string | null; last_name: string | null; company_name: string | null; stage: string } | null;
              const d = s.data as Answers;
              return (
                <tr key={s.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-faint">{ago(s.created_at)}</td>
                  <td className="px-4 py-3">{c ? <span className="flex flex-col gap-1"><Link href={`/crm/contacts/${c.id}`} className="hover:underline">{fullName(c)}</Link><StageBadge stage={c.stage} /></span> : <span className="text-faint">anonymous</span>}</td>
                  {cols.slice(0, 6).map((f) => <td key={f.id} className="max-w-56 px-4 py-3 text-fg-2">{show(d[f.id])}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      {cols.length > 6 && <p className="text-xs text-faint">Showing 6 of {cols.length} questions. Export CSV for everything, or open the driver to see the full answers in their notes.</p>}
    </div>
  );
}

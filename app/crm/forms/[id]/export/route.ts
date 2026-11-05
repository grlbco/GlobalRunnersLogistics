import { requireStaff } from "@/lib/crm/auth";
import { allFields, type Answers, type FormSchema } from "@/lib/formbuilder/schema";

const cell = (v: unknown) => {
  const s = v === true ? "Yes" : v === false ? "No" : Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v);
  return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : "") + s.replace(/"/g, '""')}"` : s;
};

/** CSV of every submission for one form (staff only). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const { supabase } = await requireStaff(`/crm/forms/${id}`, "forms.view");
  const { data: form } = await supabase.from("crm_forms").select("slug, schema").eq("id", id).maybeSingle();
  if (!form) return new Response("Not found", { status: 404 });
  const { data: subs } = await supabase.from("crm_form_submissions").select("created_at, data, contact_id").eq("form_id", id).order("created_at", { ascending: false }).limit(10000);
  const cols = allFields(form.schema as FormSchema).filter((f) => f.type !== "statement");
  const rows = [["submitted_at", "contact_id", ...cols.map((c) => (c.type === "consent" ? "text_consent" : c.label))].map(cell).join(",")];
  for (const s of subs ?? []) rows.push([s.created_at, s.contact_id ?? "", ...cols.map((c) => (s.data as Answers)[c.id])].map(cell).join(","));
  return new Response("﻿" + rows.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${form.slug}-submissions.csv"` } });
}

"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePerm } from "@/lib/crm/auth";
import { TEMPLATES, emptySchema, onSubmitZ, schemaZ } from "@/lib/formbuilder/schema";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "form";

export async function createForm(formData: FormData) {
  const { supabase, staff } = await requirePerm("forms.manage");
  const key = String(formData.get("template") ?? "blank");
  const t = TEMPLATES[key];
  const name = t?.name ?? "New form";
  const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await supabase
    .from("crm_forms")
    .insert({ name, slug, schema: t?.schema ?? emptySchema(name), on_submit: t?.on_submit ?? { assistant: "none", telegram: true }, created_by: staff.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/crm/forms/${data.id}`);
}

const saveZ = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,60}$/, "Link name: lowercase letters, numbers and dashes"),
  status: z.enum(["draft", "published", "closed"]),
  schema: schemaZ,
  on_submit: onSubmitZ,
});

export async function saveForm(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requirePerm("forms.manage");
  const p = saveZ.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Invalid form" };
  const f = p.data;
  const ids = f.schema.pages.flatMap((pg) => pg.fields.map((x) => x.id));
  if (new Set(ids).size !== ids.length) return { ok: false, error: "Two questions have the same id" };
  if (f.status === "published" && !f.schema.pages.some((pg) => pg.fields.some((x) => x.type === "phone" || x.type === "email")))
    return { ok: false, error: "Add a phone or email question before publishing, so answers can reach a driver's profile." };
  const { data: before } = await supabase.from("crm_forms").select("slug").eq("id", f.id).maybeSingle();
  const { error } = await supabase.from("crm_forms").update({ name: f.name, slug: f.slug, status: f.status, schema: f.schema, on_submit: f.on_submit, updated_at: new Date().toISOString() }).eq("id", f.id);
  if (error) return { ok: false, error: error.code === "23505" ? "That link name is taken" : error.message };
  // the public page is cached: expire it so the change shows on the next open
  updateTag(`form:${f.slug}`);
  if (before?.slug && before.slug !== f.slug) updateTag(`form:${before.slug}`);
  revalidatePath("/crm/forms");
  revalidatePath(`/crm/forms/${f.id}`);
  return { ok: true };
}

export async function deleteForm(formData: FormData) {
  const { supabase } = await requirePerm("forms.manage");
  const { data: gone } = await supabase.from("crm_forms").delete().eq("id", String(formData.get("id"))).select("slug").maybeSingle();
  if (gone?.slug) updateTag(`form:${gone.slug}`);
  revalidatePath("/crm/forms");
  redirect("/crm/forms");
}

/** AI translation of a form to Spanish (fills only what's missing; answers stay in English). */
export async function translateFormToSpanish(input: unknown): Promise<{ ok: boolean; schema?: z.infer<typeof schemaZ>; error?: string }> {
  await requirePerm("forms.manage");
  const p = schemaZ.safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid form" };
  const s = p.data;
  const src = {
    settings: { title: s.settings.title, description: s.settings.description, submitText: s.settings.submitText, successMessage: s.settings.successMessage },
    fields: s.pages.flatMap((pg) => pg.fields).filter((f) => f.type !== "consent").map((f) => ({ id: f.id, label: f.label, description: f.description, placeholder: f.placeholder, options: f.options })),
    pages: s.pages.map((pg) => ({ id: pg.id, title: pg.title })),
  };
  const { chatJson, extractJson } = await import("@/lib/integrations/deepseek");
  try {
    const r = await chatJson([
      { role: "system", content: "Translate this trucking job form from English to natural Mexican/US Spanish that truck drivers use (tú, casual, short). Keep CDL-A, OTR, MC, DOT and numbers as they are. Return JSON with the same shape: {settings:{title,description,submitText,successMessage}, fields:[{id,label,description,placeholder,options}], pages:[{id,title}]}. Keep ids. Options must stay in the same order and count. Omit keys that were empty." },
      { role: "user", content: JSON.stringify(src) },
    ], { temperature: 0.2, maxTokens: 3000 });
    const t = extractJson(r.content) as { settings?: Record<string, string>; fields?: { id: string; label?: string; description?: string; placeholder?: string; options?: string[] }[]; pages?: { id: string; title?: string }[] };
    const byId = new Map((t.fields ?? []).map((f) => [f.id, f]));
    const out = structuredClone(s);
    out.settings.es = { ...Object.fromEntries(Object.entries(t.settings ?? {}).filter(([, v]) => typeof v === "string" && v)), ...(s.settings.es ?? {}) };
    for (const pg of out.pages) {
      for (const f of pg.fields) {
        const tr = byId.get(f.id);
        if (!tr || f.type === "consent") continue;
        const opts = Array.isArray(tr.options) && tr.options.length === (f.options ?? []).length ? tr.options.map(String) : undefined;
        f.es = { label: tr.label, description: tr.description, placeholder: tr.placeholder, options: opts, ...(f.es ?? {}) };
      }
    }
    return { ok: true, schema: out };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Translation failed" };
  }
}

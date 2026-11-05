"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/crm/auth";
import { TEMPLATES, emptySchema, onSubmitZ, schemaZ } from "@/lib/formbuilder/schema";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "form";

export async function createForm(formData: FormData) {
  const { supabase, staff } = await requireStaff();
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
  const { supabase } = await requireStaff();
  const p = saveZ.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Invalid form" };
  const f = p.data;
  const ids = f.schema.pages.flatMap((pg) => pg.fields.map((x) => x.id));
  if (new Set(ids).size !== ids.length) return { ok: false, error: "Two questions have the same id" };
  if (f.status === "published" && !f.schema.pages.some((pg) => pg.fields.some((x) => x.type === "phone" || x.type === "email")))
    return { ok: false, error: "Add a phone or email question before publishing, so answers can reach a driver's profile." };
  const { error } = await supabase.from("crm_forms").update({ name: f.name, slug: f.slug, status: f.status, schema: f.schema, on_submit: f.on_submit, updated_at: new Date().toISOString() }).eq("id", f.id);
  if (error) return { ok: false, error: error.code === "23505" ? "That link name is taken" : error.message };
  revalidatePath("/crm/forms");
  revalidatePath(`/crm/forms/${f.id}`);
  return { ok: true };
}

export async function deleteForm(formData: FormData) {
  const { supabase, staff } = await requireStaff();
  if (staff.role !== "admin") return;
  await supabase.from("crm_forms").delete().eq("id", String(formData.get("id")));
  revalidatePath("/crm/forms");
  redirect("/crm/forms");
}

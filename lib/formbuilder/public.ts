import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { adminDb } from "@/lib/crm/admin";
import type { FormSchema } from "./schema";

/**
 * Published form for /f/<slug>, cached (no database hit on open). Saving the form in the CRM
 * expires the tag, so changes show up on the next open.
 */
export async function getPublicForm(slug: string): Promise<{ slug: string; status: string; schema: FormSchema } | null> {
  "use cache";
  cacheTag(`form:${slug}`);
  cacheLife("max");
  const { data } = await adminDb().from("crm_forms").select("slug, status, schema").eq("slug", slug).maybeSingle();
  return data ? { slug: data.slug, status: data.status, schema: data.schema as FormSchema } : null;
}

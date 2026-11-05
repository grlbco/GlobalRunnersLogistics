"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/crm/auth";
import { adminDb } from "@/lib/crm/admin";

const costsZ = z.object({ instantly: z.number().min(0).max(100000), quo: z.number().min(0).max(100000), leads: z.number().min(0).max(100000), other: z.number().min(0).max(100000) });

export async function saveCosts(input: unknown): Promise<{ ok: boolean }> {
  const { staff } = await requireStaff();
  if (staff.role !== "admin") return { ok: false };
  const p = costsZ.safeParse(input);
  if (!p.success) return { ok: false };
  await adminDb().from("app_settings").upsert({ key: "costs", value: p.data, updated_at: new Date().toISOString() });
  revalidatePath("/crm/reports");
  return { ok: true };
}

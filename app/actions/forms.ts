"use server";

import { trackStep } from "@/lib/crm/forms";

/** Public: progress on a personal form link (opened, step reached). Token is the only key. */
export async function trackFormStep(token: string, step: number) {
  if (typeof token !== "string" || !/^[0-9a-f]{24}$/.test(token)) return;
  if (!Number.isInteger(step) || step < 0 || step > 5) return;
  await trackStep(token, step + 1).catch(() => {});
}

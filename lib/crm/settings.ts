import "server-only";
import { adminDb } from "./admin";

export type AssistantSettings = {
  enabled: boolean;
  draft_mode: boolean;
  max_per_day: number;
  delay_min_s: number;
  delay_max_s: number;
  max_followups: number;
  auto_after: number; // approved drafts before draft mode turns itself off (0 = never)
};
const DEFAULTS: AssistantSettings = { enabled: false, draft_mode: true, max_per_day: 3, delay_min_s: 120, delay_max_s: 540, max_followups: 5, auto_after: 0 };

export async function getAssistantSettings(): Promise<AssistantSettings> {
  const { data } = await adminDb().from("app_settings").select("value").eq("key", "assistant").maybeSingle();
  return { ...DEFAULTS, ...((data?.value as Partial<AssistantSettings>) ?? {}) };
}

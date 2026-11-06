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

/** Facts sheet sign-off. Any change to the facts makes a new version, which needs approving again. */
export type FactsApproval = { version: string; by: string; at: string };
export async function getFactsApproval(): Promise<FactsApproval | null> {
  const { data } = await adminDb().from("app_settings").select("value").eq("key", "facts_approval").maybeSingle();
  return (data?.value as FactsApproval | undefined) ?? null;
}

/** Kinds of message a person has switched to auto-send. */
export async function getAutoGroups(): Promise<string[]> {
  const { data } = await adminDb().from("app_settings").select("value").eq("key", "autosend").maybeSingle();
  return ((data?.value as { groups?: string[] } | undefined)?.groups) ?? [];
}

export async function getAssistantSettings(): Promise<AssistantSettings> {
  const { data } = await adminDb().from("app_settings").select("value").eq("key", "assistant").maybeSingle();
  return { ...DEFAULTS, ...((data?.value as Partial<AssistantSettings>) ?? {}) };
}

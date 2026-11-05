import "server-only";
import { adminDb } from "./admin";

/**
 * Two switches must both be on for anything to go out:
 *  - SENDING_ENABLED=true in the environment (hard kill, set per deployment)
 *  - the "All sending" switch in CRM → Settings (instant, no redeploy)
 */
let cache: { at: number; on: boolean } | null = null;
export async function isSendingOn(): Promise<boolean> {
  if (process.env.SENDING_ENABLED !== "true") return false;
  if (cache && Date.now() - cache.at < 5000) return cache.on;
  const { data } = await adminDb().from("app_settings").select("value").eq("key", "sending").maybeSingle();
  const on = (data?.value as { enabled?: boolean } | null)?.enabled !== false;
  cache = { at: Date.now(), on };
  return on;
}
export const sendingEnvOn = () => process.env.SENDING_ENABLED === "true";
export function clearSendingCache() {
  cache = null;
}

import "server-only";
import { adminDb } from "./admin";

export type Check = { name: string; ok: boolean | null; detail: string; fix?: string };

const timed = async <T>(p: Promise<T>, ms = 6000): Promise<T> => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timed out")), ms))]);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 140);

/** Live status of every connection, for Settings → Connections. Never throws. */
export async function healthChecks(): Promise<Check[]> {
  const env = process.env;
  const checks: Promise<Check>[] = [
    (async () => {
      try {
        const { count, error } = await timed(Promise.resolve(adminDb().from("contacts").select("*", { count: "exact", head: true })));
        if (error) throw error;
        return { name: "Database (Supabase)", ok: true, detail: `${(count ?? 0).toLocaleString()} contacts` };
      } catch (e) {
        return { name: "Database (Supabase)", ok: false, detail: msg(e), fix: "Check SUPABASE_SECRET_KEY" };
      }
    })(),
    (async () => {
      if (!env.QUO_API_KEY) return { name: "Quo (texts & calls)", ok: false, detail: "Not connected", fix: "Add QUO_API_KEY" };
      try {
        const quo = await import("@/lib/integrations/quo");
        await timed(quo.phoneNumberId());
        return { name: "Quo (texts & calls)", ok: true, detail: `Number ${env.QUO_FROM_NUMBER ?? ""}${env.QUO_WEBHOOK_SECRET ? " · webhook signed" : " · webhook secret missing (fine locally)"}` };
      } catch (e) {
        return { name: "Quo (texts & calls)", ok: false, detail: msg(e) };
      }
    })(),
    (async () => {
      if (!env.INSTANTLY_API_KEY) return { name: "Instantly (cold email)", ok: false, detail: "Not connected", fix: "Add INSTANTLY_API_KEY" };
      try {
        const ins = await import("@/lib/integrations/instantly");
        const accts = await timed(ins.listAccounts());
        return { name: "Instantly (cold email)", ok: accts.length > 0, detail: `${accts.length} sending inbox${accts.length === 1 ? "" : "es"}`, fix: accts.length ? undefined : "Add warmed inboxes in Instantly" };
      } catch (e) {
        return { name: "Instantly (cold email)", ok: false, detail: msg(e) };
      }
    })(),
    (async () => {
      if (!env.DEEPSEEK_API_KEY) return { name: "DeepSeek (assistant)", ok: false, detail: "Not connected", fix: "Add DEEPSEEK_API_KEY" };
      try {
        const r = await timed(fetch("https://api.deepseek.com/models", { headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` } }));
        return { name: "DeepSeek (assistant)", ok: r.ok, detail: r.ok ? `Model ${env.DEEPSEEK_MODEL ?? "deepseek-flash"}` : `HTTP ${r.status}` };
      } catch (e) {
        return { name: "DeepSeek (assistant)", ok: false, detail: msg(e) };
      }
    })(),
    (async () => {
      if (!env.RESEND_API_KEY) return { name: "Resend (alerts & direct email)", ok: false, detail: "Not connected", fix: "Add RESEND_API_KEY" };
      try {
        const r = await timed(fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` } }));
        const j = (await r.json().catch(() => ({}))) as { data?: { name: string; status: string }[] };
        const d = j.data?.find((x) => x.status === "verified");
        return { name: "Resend (alerts & direct email)", ok: r.ok && !!d, detail: d ? `Sending from ${d.name}` : r.ok ? "No verified domain" : `HTTP ${r.status}` };
      } catch (e) {
        return { name: "Resend (alerts & direct email)", ok: false, detail: msg(e) };
      }
    })(),
    (async () => {
      if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return { name: "Telegram (Ken's alerts)", ok: false, detail: "Not set up", fix: "Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (steps in .env.example)" };
      try {
        const r = await timed(fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`));
        const j = (await r.json()) as { ok: boolean; result?: { username: string } };
        return { name: "Telegram (Ken's alerts)", ok: j.ok, detail: j.ok ? `@${j.result?.username} → group ${env.TELEGRAM_CHAT_ID}` : "Bad token" };
      } catch (e) {
        return { name: "Telegram (Ken's alerts)", ok: false, detail: msg(e) };
      }
    })(),
    Promise.resolve<Check>({ name: "Ken's alert phone", ok: !!env.NOTIFY_SMS_TO, detail: env.NOTIFY_SMS_TO ?? "Not set", fix: env.NOTIFY_SMS_TO ? undefined : "Add NOTIFY_SMS_TO" }),
    Promise.resolve<Check>({ name: "Background worker", ok: env.NODE_ENV !== "production" ? null : !!env.WORKER_SECRET, detail: env.NODE_ENV !== "production" ? "Runs from the open CRM tab while testing locally" : env.WORKER_SECRET ? "Scheduled every minute" : "WORKER_SECRET missing" }),
  ];
  return Promise.all(checks);
}

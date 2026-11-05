import { clsx } from "clsx";
import { adminDb } from "@/lib/crm/admin";
import { getAssistantSettings } from "@/lib/crm/settings";
import { isSendingOn } from "@/lib/crm/sending";
import { Card, Label } from "./ui";
import { GoLiveTick } from "./GoLiveTick";

/** Heartbeat within the last 5 minutes. */
const recent = (iso?: string) => !!iso && Date.now() - new Date(iso).getTime() < 5 * 60_000;

type Item = { key: string; label: string; done: boolean; hint: string; manual?: boolean };

/** Launch readiness. Auto-checks what it can; the rest is ticked by an admin. Hides itself once everything is done. */
export async function GoLive({ isAdmin }: { isAdmin: boolean }) {
  const db = adminDb();
  const [{ data: gl }, { data: worker }, { count: campaigns }, assistant, sending, inboxes] = await Promise.all([
    db.from("app_settings").select("value").eq("key", "golive").maybeSingle(),
    db.from("app_settings").select("value").eq("key", "worker").maybeSingle(),
    db.from("campaigns").select("*", { count: "exact", head: true }),
    getAssistantSettings(),
    isSendingOn(),
    (async () => {
      if (!process.env.INSTANTLY_API_KEY) return 0;
      try {
        const { listAccounts } = await import("@/lib/integrations/instantly");
        return (await listAccounts()).filter((a) => !/airmailcadence/i.test(a.email ?? "")).length;
      } catch {
        return 0;
      }
    })(),
  ]);
  const v = (gl?.value ?? {}) as { manual?: Record<string, boolean>; password_changed?: Record<string, string> };
  const m = v.manual ?? {};
  const lastTick = (worker?.value as { last_tick?: string } | null)?.last_tick;
  const live = !!process.env.VERCEL && process.env.NODE_ENV === "production";
  const env = process.env;
  const items: Item[] = [
    { key: "deploy", label: "Live on globalrunnerslogistics.com", done: live, hint: "Reconnect Vercel and deploy (docs/DEPLOY.md step 1)" },
    { key: "worker", label: "Background worker runs every minute", done: recent(lastTick), hint: "Run supabase/deploy/worker-cron.sql (step 3)" },
    { key: "hooks", label: "Quo + Instantly webhooks connected", done: !!env.QUO_WEBHOOK_SECRET && !!env.INSTANTLY_WEBHOOK_SECRET, hint: "node scripts/register-webhooks.mjs (step 4)" },
    { key: "telegram", label: "Ken's Telegram alerts", done: !!env.TELEGRAM_BOT_TOKEN && !!env.TELEGRAM_CHAT_ID, hint: "4 steps in .env.example" },
    { key: "inboxes", label: "Warmed Instantly inboxes (3+)", done: inboxes >= 3, hint: `${inboxes} real inbox${inboxes === 1 ? "" : "es"} connected (the free AirMail one doesn't count)` },
    { key: "password", label: "Admin password changed from 1234", done: Object.keys(v.password_changed ?? {}).length > 0, hint: "CRM → Settings → Your password" },
    { key: "leaked_pw", label: "Supabase leaked-password protection on", done: !!m.leaked_pw, hint: "Supabase → Auth → Passwords", manual: true },
    { key: "ken_facts", label: "Ken confirmed pay rate, home time, hazmat, MC/DOT", done: !!m.ken_facts, hint: "Update the facts the assistant uses", manual: true },
    { key: "sending", label: "Sending switched on", done: sending, hint: "CRM → Settings → All sending" },
    { key: "assistant", label: "Assistant on, draft mode for the first 50", done: assistant.enabled, hint: assistant.draft_mode ? "Draft mode is on (good for the pilot)" : "Turn draft mode on for the pilot" },
    { key: "campaign", label: "Pilot campaign created (10 leads)", done: (campaigns ?? 0) > 0, hint: "CRM → Campaigns → New, add a 10-lead wave" },
    { key: "pilot_tested", label: "Pilot replies checked end to end", done: !!m.pilot_tested, hint: "Reply → assistant → form → Applied → Telegram", manual: true },
    { key: "call_tested", label: "Call me now + missed call tested", done: !!m.call_tested, hint: "Tap Call me now on a form; call the Quo number and don't answer", manual: true },
  ];
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label>Go-live checklist</Label>
        <span className="text-sm tabular-nums text-white/60">{done} / {items.length} done</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-signal" style={{ width: `${(done / items.length) * 100}%` }} /></div>
      <ul className="mt-4 grid gap-x-8 gap-y-2.5 text-sm md:grid-cols-2">
        {items.map((i) => (
          <li key={i.key} className="flex items-start gap-3">
            {i.manual && isAdmin ? <GoLiveTick item={i.key} done={i.done} /> : <span className={clsx("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]", i.done ? "bg-emerald-500 text-white" : "border border-white/25")}>{i.done ? "✓" : ""}</span>}
            <span>
              <span className={clsx(i.done && "text-white/45 line-through decoration-white/20")}>{i.label}</span>
              {!i.done && <span className="block text-xs text-white/40">{i.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

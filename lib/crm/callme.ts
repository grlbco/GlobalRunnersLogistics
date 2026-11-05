import "server-only";
import { adminDb } from "./admin";
import { activity, contactByPhone, moveStage, type Contact } from "./ingest";
import { company } from "@/content/facts";
import { siteUrl } from "@/lib/site";
import { sendTelegram, esc } from "@/lib/integrations/telegram";
import { phoneDisplay } from "./format";

/** Ken's call window (Settings → Calls). Outside it, "Call me now" becomes "first thing tomorrow". */
export type CallHours = { start: string; end: string; tz: string; days: number[] };
const DEFAULT_HOURS: CallHours = { start: "07:00", end: "19:00", tz: "America/Los_Angeles", days: [1, 2, 3, 4, 5, 6] };

export async function getCallHours(): Promise<CallHours> {
  const { data } = await adminDb().from("app_settings").select("value").eq("key", "calls").maybeSingle();
  return { ...DEFAULT_HOURS, ...((data?.value as Partial<CallHours>) ?? {}) };
}

export function inCallHours(h: CallHours, at = new Date()) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: h.tz, hour: "numeric", minute: "numeric", hour12: false, weekday: "short" }).formatToParts(at);
  const hh = Number(p.find((x) => x.type === "hour")?.value) % 24;
  const mm = Number(p.find((x) => x.type === "minute")?.value);
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.find((x) => x.type === "weekday")?.value ?? "");
  const now = hh * 60 + mm;
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  return h.days.includes(wd) && now >= toMin(h.start) && now < toMin(h.end);
}

export type CallRequest = { ok: true; inHours: boolean; kenPhone: string; contactId: string } | { ok: false; error: string };

/**
 * A driver asked to be called now (button, personal link, or a text like "call me").
 * Ken gets it instantly (Telegram + text to his cell), the team gets an urgent task,
 * the card moves forward and the driver hears back with Ken's number.
 */
export async function requestCall(p: { contactId?: string | null; phone?: string | null; name?: string | null; source: string; notifyDriver?: boolean }): Promise<CallRequest> {
  const db = adminDb();
  type C = Contact & { last_name?: string | null; state?: string | null };
  let c: C | null = null;
  if (p.contactId) c = (await db.from("contacts").select("id, stage, email, phone, cell_phone, do_not_contact, sms_consent, agent_mode, first_name, last_name, state").eq("id", p.contactId).maybeSingle()).data as C | null;
  if (!c && p.phone) c = (await contactByPhone(p.phone)) as C | null;
  if (!c) {
    if (!p.phone) return { ok: false, error: "Phone number needed" };
    const [first, ...rest] = (p.name ?? "").trim().split(/\s+/);
    const { data, error } = await db.from("contacts").insert({ first_name: first || null, last_name: rest.join(" ") || null, cell_phone: p.phone, source: p.source, stage: "replied", tags: ["call-request"] }).select("id, stage, email, phone, cell_phone, do_not_contact, sms_consent, agent_mode, first_name, last_name, state").single();
    if (error) return { ok: false, error: "Couldn't save the request" };
    c = data as C;
  }
  const contact = c!;

  // one alert per driver per 15 minutes (double taps, repeated texts)
  const { count } = await db.from("activities").select("*", { count: "exact", head: true }).eq("contact_id", contact.id).eq("type", "call_requested").gte("created_at", new Date(Date.now() - 15 * 60_000).toISOString());
  const hours = await getCallHours();
  const inHours = inCallHours(hours);
  if (count) return { ok: true, inHours, kenPhone: company.phone.display, contactId: contact.id };

  await moveStage(contact, "interested", p.source);
  await activity(contact.id, "call_requested", { source: p.source, in_hours: inHours }, p.source);
  await db.from("tasks").insert({ contact_id: contact.id, title: `📞 CALL NOW: ${[contact.first_name, contact.last_name].filter(Boolean).join(" ") || "driver"} asked for a call`, due_at: new Date().toISOString(), created_by: "workflow" });

  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "A driver";
  const phone = contact.cell_phone ?? contact.phone ?? p.phone ?? "";
  const link = `${siteUrl()}/crm/contacts/${contact.id}`;
  await sendTelegram(`📞 <b>Call now: ${esc(name)}</b>${contact.state ? ` (${esc(contact.state)})` : ""}\n<a href="tel:${esc(phone)}">${esc(phoneDisplay(phone) ?? phone)}</a>\nAsked via ${esc(p.source.replace(/_/g, " "))}${inHours ? "" : "\n⏰ After hours: told them you'll call first thing."}\n\n<a href="${link}">Open in GRL Command</a>`);
  const kenCell = process.env.NOTIFY_SMS_TO;
  if (kenCell && process.env.SENDING_ENABLED === "true") {
    const { sendText } = await import("@/lib/integrations/quo");
    await sendText(kenCell, `CALL NOW: ${name} ${phoneDisplay(phone) ?? phone} wants a call${inHours ? "" : " (after hours, first thing tomorrow)"}. ${link}`).catch(() => {});
  }

  // let the driver know (only by text when they agreed to texts)
  if (p.notifyDriver !== false && contact.sms_consent && !contact.do_not_contact) {
    const body = inHours
      ? `Got it${contact.first_name ? ` ${contact.first_name}` : ""}, Ken's calling you in a few minutes from ${company.phone.display}. Save the number so you pick up.`
      : `Got it${contact.first_name ? ` ${contact.first_name}` : ""}. Ken's done for today, he'll call you first thing in the morning from ${company.phone.display}.`;
    await db.from("outbox").insert({ contact_id: contact.id, channel: "sms", author: "workflow", body, status: "pending", send_after: new Date(Date.now() + 5000).toISOString(), is_reply: true });
  }
  const { emit } = await import("@/lib/automations/engine");
  await emit("call_requested", contact.id, {});
  return { ok: true, inHours, kenPhone: company.phone.display, contactId: contact.id };
}

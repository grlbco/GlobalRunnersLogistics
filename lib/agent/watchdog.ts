import "server-only";
import { adminDb } from "@/lib/crm/admin";
import { activity, moveStage, type Contact } from "@/lib/crm/ingest";
import { sendTelegram, esc, DIVIDER } from "@/lib/integrations/telegram";
import { formLinkFor, scheduleNext, withFormLink } from "./engine";

/**
 * Safety net that runs every minute. Each check finds drivers the workflow dropped, fixes what it can
 * on its own, and tells the team in Telegram once per problem. Nothing a driver did should go unanswered.
 *
 *  1. A driver wrote and got no answer (AI failed, timed out, or the queue lost it) → retry once, then alert.
 *  2. A driver said yes but has no form link after 10 min → send the link (email in the thread + texts) and alert.
 *  3. A message stuck in the outbox 20+ min past its time (not a quiet-hours hold) → alert.
 *  4. A form follow-up failed 3 times → alert.
 */
const MIN = 60_000;
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://globalrunnerslogistics.com";
const name = (c: { first_name?: string | null; last_name?: string | null }) => [c.first_name, c.last_name].filter(Boolean).join(" ") || "Driver";

async function once(contactId: string, kind: string, ref: string) {
  const db = adminDb();
  const { data } = await db.from("activities").select("id").eq("contact_id", contactId).eq("type", "watchdog").contains("data", { kind, ref }).limit(1);
  if (data?.length) return false;
  await activity(contactId, "watchdog", { kind, ref }, "system");
  return true;
}

async function alert(c: { id: string; first_name?: string | null; last_name?: string | null }, title: string, detail: string, fixed: boolean) {
  await sendTelegram(
    `${fixed ? "🛠️" : "⚠️"} <b>${esc(title)}</b>\n${DIVIDER}\n👤 <b>${esc(name(c))}</b>\n\n${esc(detail)}${fixed ? "\n\n✅ Fixed automatically. Nothing for you to do." : "\n\n👉 Please check this driver."}`,
    [[{ text: "👤 Open in GRL Command", url: `${siteUrl()}/crm/contacts/${c.id}` }]],
  );
}

export async function watchdog() {
  const db = adminDb();
  const now = Date.now();
  const res = { retried: 0, linksSent: 0, alerts: 0 };

  // 1) Unanswered driver messages (8 min to 48 h old)
  const { data: inbound } = await db
    .from("messages")
    .select("id, contact_id, channel, created_at, meta, contacts!inner(id, first_name, last_name, agent_mode, do_not_contact, stage)")
    .eq("direction", "inbound")
    .gte("created_at", new Date(now - 48 * 60 * MIN).toISOString())
    .lte("created_at", new Date(now - 8 * MIN).toISOString())
    .order("created_at", { ascending: false })
    .limit(200);
  const newestPerContact = new Map<string, NonNullable<typeof inbound>[number]>();
  for (const m of inbound ?? []) if (!newestPerContact.has(m.contact_id)) newestPerContact.set(m.contact_id, m);
  for (const m of newestPerContact.values()) {
    const c = m.contacts as unknown as { id: string; first_name: string | null; last_name: string | null; agent_mode: string; do_not_contact: boolean; stage: string };
    if ((m.meta as { auto_reply?: boolean } | null)?.auto_reply) continue;
    if (c.agent_mode !== "auto" || c.do_not_contact || ["unsubscribed", "bounced", "not_fit"].includes(c.stage)) continue;
    const [{ data: outAfter }, { data: queuedOrSent }, { data: runs }] = await Promise.all([
      db.from("messages").select("id").eq("contact_id", c.id).eq("direction", "outbound").gt("created_at", m.created_at).limit(1),
      db.from("outbox").select("id").eq("contact_id", c.id).in("status", ["pending", "draft", "sending", "sent"]).gt("created_at", m.created_at).limit(1),
      db.from("agent_runs").select("action, created_at").eq("contact_id", c.id).gte("created_at", m.created_at).order("created_at", { ascending: false }).limit(1),
    ]);
    if (outAfter?.length || queuedOrSent?.length) continue;
    const last = runs?.[0];
    // a deliberate no-answer (not interested, opted out, handed to a person, paused) is fine
    if (last && ["no_reply", "unsubscribed", "handed_off", "ignored", "draft", "superseded", "merged"].includes(last.action)) continue;
    if (last && (last.action === "queued" || (last.action === "running" && now - new Date(last.created_at).getTime() < 5 * MIN))) continue;
    if (await once(c.id, "unanswered_retry", m.id)) {
      await db.from("agent_runs").insert({ contact_id: c.id, trigger: m.channel === "sms" ? "text_received" : "email_received", input_message_id: m.id, action: "queued" });
      res.retried++;
    } else if (now - new Date(m.created_at).getTime() > 25 * MIN && (await once(c.id, "unanswered_alert", m.id))) {
      await alert(c, "Driver message not answered", `They wrote ${m.channel === "sms" ? "a text" : "an email"} and the assistant couldn't answer, even after a retry.`, false);
      res.alerts++;
    }
  }

  // 2) Said yes, no form link after 10 minutes
  const { data: interested } = await db
    .from("contacts")
    .select("id, first_name, last_name, email, phone, cell_phone, sms_consent, timezone, stage, agent_mode, do_not_contact")
    .eq("stage", "interested")
    .eq("agent_mode", "auto")
    .eq("do_not_contact", false)
    .lte("stage_changed_at", new Date(now - 10 * MIN).toISOString())
    .limit(50);
  for (const c of interested ?? []) {
    const link = await formLinkFor(c.id);
    if (link.form.sent || link.form.completed) continue;
    const { data: waiting } = await db.from("outbox").select("id").eq("contact_id", c.id).in("status", ["pending", "draft", "sending"]).limit(1);
    const { data: busy } = await db.from("agent_runs").select("id").eq("contact_id", c.id).in("action", ["queued", "running"]).limit(1);
    if (waiting?.length || busy?.length) continue;
    if (!(await once(c.id, "yes_no_link", link.token))) continue;
    const first = (c.first_name ?? "").trim().split(/\s+/)[0];
    const at = (s: number) => new Date(now + s * 1000).toISOString();
    if (c.email) {
      const body = withFormLink(`Hi${first ? ` ${first}` : ""},\n\nThanks for getting back to us.\n\nClaudia\nGlobal Runners Logistics`, link.url, "email");
      await db.from("outbox").insert({ contact_id: c.id, channel: "email", author: "agent", body, status: "pending", send_after: at(5), is_reply: true });
    }
    if (c.sms_consent && (c.cell_phone || c.phone)) {
      const { count } = await db.from("messages").select("*", { count: "exact", head: true }).eq("contact_id", c.id).eq("channel", "sms").eq("direction", "outbound");
      await db.from("outbox").insert({ contact_id: c.id, channel: "sms", author: "agent", body: `hi${first ? ` ${first}` : ""}, it's Claudia from Global Runners about the CDL-A job you replied to`, status: "pending", send_after: at(30), is_reply: false });
      await db.from("outbox").insert({ contact_id: c.id, channel: "sms", author: "agent", body: `here's the short form, takes about 2 min: ${link.url}${count ? "" : " Reply STOP to opt out."}`, status: "pending", send_after: at(45), is_reply: false });
    }
    if (!c.email && !(c.sms_consent && (c.cell_phone || c.phone))) {
      await alert(c, "Said yes, no way to send the form", "They're interested but we have no email thread or textable phone.", false);
      res.alerts++;
      continue;
    }
    await db.from("form_links").update({ sent_at: new Date().toISOString() }).eq("token", link.token);
    await moveStage(c as unknown as Contact, "form_sent", "system");
    await db.from("followups").update({ status: "cancelled" }).eq("contact_id", c.id).eq("status", "pending");
    await scheduleNext(c, { linkOut: true, kind: null, attempt: 0, maxNudges: 7 });
    await alert(c, "Form link was missing, sent it", "They said yes but no form link went out. The watchdog sent it by email and text and started the form follow-ups.", true);
    res.linksSent++;
  }

  // 3) Outbox stuck past its time (a quiet-hours hold is fine)
  const { data: stuck } = await db
    .from("outbox")
    .select("id, contact_id, channel, error, send_after, contacts!inner(id, first_name, last_name)")
    .eq("status", "pending")
    .lte("send_after", new Date(now - 20 * MIN).toISOString())
    .limit(50);
  for (const o of stuck ?? []) {
    if ((o.error ?? "").includes("8am")) continue;
    const c = o.contacts as unknown as { id: string; first_name: string | null; last_name: string | null };
    if (await once(c.id, "outbox_stuck", o.id)) {
      await alert(c, `${o.channel === "sms" ? "Text" : "Email"} stuck, not sent`, `It was due 20+ minutes ago.${o.error ? ` Last error: ${o.error}` : ""}`, false);
      res.alerts++;
    }
  }

  // 4) Follow-ups that failed 3 times
  const { data: failed } = await db
    .from("followups")
    .select("id, contact_id, reason, contacts!inner(id, first_name, last_name)")
    .eq("status", "failed")
    .gte("created_at", new Date(now - 14 * 24 * 60 * MIN).toISOString())
    .limit(50);
  for (const f of failed ?? []) {
    const c = f.contacts as unknown as { id: string; first_name: string | null; last_name: string | null };
    if (await once(c.id, "followup_failed", f.id)) {
      await alert(c, "Follow-up failed", `${f.reason ?? "A follow-up"} couldn't be written after 3 tries, so the chase is paused for this driver.`, false);
      res.alerts++;
    }
  }
  // 5) Alerts the team asked to (re)send, e.g. a corrected "APPLICATION IN" card
  const { data: asks } = await db.from("activities").select("id, contact_id, data").eq("type", "alert_requested").is("data->>sent", null).limit(10);
  for (const a of asks ?? []) {
    const d = (a.data ?? {}) as { kind?: string; note?: string };
    await db.from("activities").update({ data: { ...d, sent: new Date().toISOString() } }).eq("id", a.id);
    if (d.kind === "application") {
      const { sendApplicationAlert } = await import("@/lib/crm/forms");
      await sendApplicationAlert(a.contact_id, d.note);
      res.alerts++;
    }
  }
  return res;
}

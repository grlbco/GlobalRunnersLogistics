import { clsx } from "clsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stageLabel } from "@/lib/crm/stages";
import { REPLY_WINDOW_MS } from "@/lib/crm/sendGate";

export type Item =
  | { kind: "message"; at: string; channel: string; direction: string; author: string; subject: string | null; body: string; status: string }
  | { kind: "activity"; at: string; type: string; data: Record<string, unknown>; actor: string }
  | { kind: "note"; at: string; body: string; author_kind: string };

/** Every email, text, call, note and activity for one contact, newest first. */
export async function loadTimeline(supabase: SupabaseClient, id: string): Promise<Item[]> {
  const [msgs, acts, notes] = await Promise.all([
    supabase.from("messages").select("channel, direction, author, subject, body, status, created_at").eq("contact_id", id).order("created_at", { ascending: false }).limit(200),
    supabase.from("activities").select("type, data, actor, created_at").eq("contact_id", id).order("created_at", { ascending: false }).limit(200),
    supabase.from("notes").select("body, author_kind, created_at").eq("contact_id", id).order("created_at", { ascending: false }).limit(100),
  ]);
  return [
    ...(msgs.data ?? []).map((m) => ({ kind: "message" as const, at: m.created_at, ...m })),
    ...(acts.data ?? []).map((a) => ({ kind: "activity" as const, at: a.created_at, type: a.type, data: a.data, actor: a.actor })),
    ...(notes.data ?? []).map((nt) => ({ kind: "note" as const, at: nt.created_at, body: nt.body, author_kind: nt.author_kind })),
  ].sort((a, b) => b.at.localeCompare(a.at));
}

/** The driver's latest message is a recent text: a person may answer it in that conversation. */
export function answeringText(items: Item[]) {
  const last = items.find((m) => m.kind === "message" && m.direction === "inbound" && m.channel !== "call");
  return !!last && last.kind === "message" && last.channel === "sms" && new Date().getTime() - new Date(last.at).getTime() < REPLY_WINDOW_MS;
}

export function Timeline({ items, oldestFirst = false }: { items: Item[]; oldestFirst?: boolean }) {
  const list = oldestFirst ? [...items].reverse() : items;
  if (!list.length) return <div className="rounded-[14px] border border-dashed border-line-strong p-10 text-center text-sm text-faint">No activity yet. Emails, texts, calls, form steps and notes will appear here.</div>;
  return <ol className="space-y-3">{list.map((it, i) => <TimelineItem key={i} it={it} />)}</ol>;
}

export function TimelineItem({ it }: { it: Item }) {
  const time = <time className="text-[0.7rem] text-faint">{new Date(it.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>;
  if (it.kind === "message") {
    const inbound = it.direction === "inbound";
    const who = inbound ? "Driver" : it.author === "agent" ? "Assistant" : it.author === "campaign" ? "Campaign" : it.author === "human" ? "You" : "System";
    const assistant = !inbound && it.author === "agent";
    return (
      <li className={clsx("max-w-[42rem]", !inbound && "ml-auto")}>
        <div className={clsx("rounded-[14px] border px-4 py-3", inbound ? "rounded-tl-[4px] border-transparent bg-hover" : assistant ? "rounded-tr-[4px] border-line-strong bg-surface" : "rounded-tr-[4px] border-line bg-surface")}>
          <div className="flex items-center justify-between gap-4 text-[0.72rem]">
            <span className="flex items-center gap-1.5 font-medium text-muted">
              {assistant && <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-fg" fill="currentColor" aria-hidden><path d="M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6-5.6-1.9 5.6-1.9z" /></svg>}
              {who} · {it.channel === "sms" ? "Text" : it.channel === "call" ? "Call" : "Email"}{it.status === "draft" ? " · draft" : ""}
            </span>
            {time}
          </div>
          {it.subject && <p className="mt-2 text-sm font-medium">{it.subject}</p>}
          <p className="mt-1 whitespace-pre-wrap text-[0.875rem] leading-relaxed text-fg">{it.body}</p>
        </div>
      </li>
    );
  }
  if (it.kind === "note") {
    return (
      <li className="max-w-[42rem] rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex justify-between text-xs"><span className="font-medium text-amber-800">Note{it.author_kind !== "human" ? ` · ${it.author_kind}` : ""}</span>{time}</div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-fg-2">{it.body}</p>
      </li>
    );
  }
  const d = it.data as { from?: string; to?: string; form_name?: string; source?: string; quote?: string };
  const text =
    it.type === "stage_changed" ? `Moved from ${stageLabel(d.from ?? "")} to ${stageLabel(d.to ?? "")}${d.quote ? `: "${d.quote}"` : ""}` :
    it.type === "form_submitted" ? `Submitted the form "${d.form_name ?? "form"}"` :
    it.type === "sms_consent" ? `Agreed to texts (${d.source ?? "consent"})` :
    it.type === "taken_over" ? "Taken over by a person" :
    it.type === "assistant_resumed" ? "Handed back to the assistant" :
    it.type.replace(/_/g, " ");
  return (
    <li className="flex items-center justify-between gap-4 px-1 py-0.5 text-[0.75rem] text-muted">
      <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-line-strong" />{text}{it.actor.startsWith("user:") ? "" : ` · ${it.actor}`}</span>
      {time}
    </li>
  );
}

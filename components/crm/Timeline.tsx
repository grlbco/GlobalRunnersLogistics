import { clsx } from "clsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stageLabel } from "@/lib/crm/stages";

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

export function Timeline({ items, oldestFirst = false }: { items: Item[]; oldestFirst?: boolean }) {
  const list = oldestFirst ? [...items].reverse() : items;
  if (!list.length) return <div className="rounded-[6px] border border-dashed border-white/10 p-10 text-center text-sm text-white/45">No activity yet. Emails, texts, calls, form steps and notes will appear here.</div>;
  return <ol className="space-y-4">{list.map((it, i) => <TimelineItem key={i} it={it} />)}</ol>;
}

export function TimelineItem({ it }: { it: Item }) {
  const time = <time className="text-[0.7rem] text-white/35">{new Date(it.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>;
  if (it.kind === "message") {
    const inbound = it.direction === "inbound";
    const who = inbound ? "Driver" : it.author === "agent" ? "Assistant" : it.author === "campaign" ? "Campaign" : it.author === "human" ? "You" : "System";
    return (
      <li className={clsx("max-w-[42rem]", !inbound && "ml-auto")}>
        <div className={clsx("rounded-[8px] border p-4", inbound ? "border-white/10 bg-white/[0.03]" : "border-signal/25 bg-signal/[0.06]")}>
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="font-medium text-white/80">{who} · {it.channel === "sms" ? "Text" : it.channel === "call" ? "Call" : "Email"}{it.status === "draft" ? " · draft" : ""}</span>
            {time}
          </div>
          {it.subject && <p className="mt-2 text-sm font-medium">{it.subject}</p>}
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-white/80">{it.body}</p>
        </div>
      </li>
    );
  }
  if (it.kind === "note") {
    return (
      <li className="rounded-[6px] border border-dusk/20 bg-dusk/[0.05] p-3">
        <div className="flex justify-between text-xs"><span className="text-dusk">Note{it.author_kind !== "human" ? ` · ${it.author_kind}` : ""}</span>{time}</div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{it.body}</p>
      </li>
    );
  }
  const d = it.data as { from?: string; to?: string };
  const text =
    it.type === "stage_changed" ? `Moved from ${stageLabel(d.from ?? "")} to ${stageLabel(d.to ?? "")}` :
    it.type === "taken_over" ? "Taken over by a person" :
    it.type === "assistant_resumed" ? "Handed back to the assistant" :
    it.type.replace(/_/g, " ");
  return (
    <li className="flex items-center justify-between gap-4 px-1 text-xs text-white/45">
      <span>{text}{it.actor.startsWith("user:") ? "" : ` · ${it.actor}`}</span>
      {time}
    </li>
  );
}

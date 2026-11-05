import type { SupabaseClient } from "@supabase/supabase-js";
import { approveDraft, discardDraft } from "@/app/crm/actions";
import { btnCls, btnGhostCls, inputCls } from "./ui";

/** Assistant messages waiting for approval or for their send time. */
export async function Drafts({ supabase, contactId }: { supabase: SupabaseClient; contactId: string }) {
  const { data } = await supabase
    .from("outbox")
    .select("id, channel, body, status, send_after, error")
    .eq("contact_id", contactId)
    .in("status", ["draft", "pending"])
    .order("created_at");
  if (!data?.length) return null;
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <form key={d.id} action={approveDraft} className="rounded-[10px] border border-amber-200 bg-amber-50/70 p-3">
          <input type="hidden" name="id" value={d.id} />
          <input type="hidden" name="contact_id" value={contactId} />
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-amber-800">
              Assistant {d.channel === "sms" ? "text" : "email"} · {d.status === "draft" ? "waiting for your OK" : `sends ${new Date(d.send_after).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
            </span>
            {d.error && <span className="text-faint">{d.error}</span>}
          </div>
          <textarea name="body" defaultValue={d.body} rows={d.channel === "sms" ? 2 : 4} className={`${inputCls} h-auto py-2`} />
          <div className="mt-2 flex justify-end gap-2">
            <button formAction={discardDraft} className={btnGhostCls}>Discard</button>
            <button className={btnCls}>{d.status === "draft" ? "Approve & send" : "Send now"}</button>
          </div>
        </form>
      ))}
    </div>
  );
}

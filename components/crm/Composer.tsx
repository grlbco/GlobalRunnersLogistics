"use client";

import { useActionState, useState } from "react";
import { clsx } from "clsx";
import { sendManual, type SendState } from "@/app/crm/actions";
import { btnCls, inputCls } from "./ui";

type Channel = "email" | "sms";

export function Composer({ contactId, email, sms, sendingOn }: { contactId: string; email: { ok: boolean; why?: string }; sms: { ok: boolean; why?: string }; sendingOn: boolean }) {
  const [channel, setChannel] = useState<Channel>(sms.ok && !email.ok ? "sms" : "email");
  const [state, action, busy] = useActionState<SendState, FormData>(sendManual, null);
  const cur = channel === "email" ? email : sms;
  const blocked = !sendingOn ? "Sending is off (Settings → All sending)." : !cur.ok ? cur.why : null;

  return (
    <form action={action} className="rounded-[8px] border border-white/10 bg-white/[0.02]">
      <input type="hidden" name="id" value={contactId} />
      <input type="hidden" name="channel" value={channel} />
      <div className="flex border-b border-white/[0.07] text-sm">
        {(["email", "sms"] as Channel[]).map((c) => (
          <button key={c} type="button" onClick={() => setChannel(c)} className={clsx("px-4 py-2.5", channel === c ? "border-b-2 border-signal text-white" : "text-white/50 hover:text-white")}>
            {c === "email" ? "Email" : "Text"}
          </button>
        ))}
      </div>
      <div className="space-y-2 p-3">
        <textarea name="body" rows={3} maxLength={channel === "sms" ? 320 : 1500} placeholder={channel === "sms" ? "Short text, like you'd send from your phone…" : "Reply in the email thread…"} className={clsx(inputCls, "h-auto py-2")} disabled={!!blocked} />
        <div className="flex items-center justify-between gap-3">
          <p className={clsx("text-xs", state ? (state.ok ? "text-emerald-300" : "text-red-300") : "text-white/40")}>{state?.message ?? blocked ?? (channel === "sms" ? "Sent from (725) 666-1558" : "Sent from the inbox in this thread")}</p>
          <button className={btnCls} disabled={busy || !!blocked}>{busy ? "Sending…" : "Send"}</button>
        </div>
      </div>
    </form>
  );
}

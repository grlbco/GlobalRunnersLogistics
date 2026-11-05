"use client";

import { useActionState, useState } from "react";
import { clsx } from "clsx";
import { sendManual, type SendState } from "@/app/crm/actions";
import { btnCls } from "./ui";

type Channel = "email" | "sms";

export function Composer({ contactId, email, sms, sendingOn }: { contactId: string; email: { ok: boolean; why?: string }; sms: { ok: boolean; why?: string }; sendingOn: boolean }) {
  const [channel, setChannel] = useState<Channel>(sms.ok && !email.ok ? "sms" : "email");
  const [state, action, busy] = useActionState<SendState, FormData>(sendManual, null);
  const cur = channel === "email" ? email : sms;
  const blocked = !sendingOn ? "Sending is off (Settings → All sending)." : !cur.ok ? cur.why : null;

  return (
    <form action={action} className="overflow-hidden rounded-[14px] border border-line-strong bg-surface transition-[border-color,box-shadow] duration-150 focus-within:border-fg focus-within:shadow-[0_0_0_3px_var(--color-hover)]">
      <input type="hidden" name="id" value={contactId} />
      <input type="hidden" name="channel" value={channel} />
      <div className="flex gap-1 px-2 pt-2 text-[0.8rem] font-medium">
        {(["email", "sms"] as Channel[]).map((c) => (
          <button key={c} type="button" onClick={() => setChannel(c)} className={clsx("rounded-[9px] px-3 py-1.5 transition-colors duration-150", channel === c ? "bg-fg text-surface" : "text-muted hover:text-fg")}>
            {c === "email" ? "Email" : "Text"}
          </button>
        ))}
      </div>
      <div className="space-y-2 p-3">
        <textarea name="body" rows={3} maxLength={channel === "sms" ? 320 : 1500} placeholder={channel === "sms" ? "Short text, like you'd send from your phone…" : "Reply in the email thread…"} className="block w-full resize-none bg-transparent px-1 py-1 text-[0.875rem] leading-relaxed text-fg placeholder:text-faint focus:outline-none disabled:text-faint" disabled={!!blocked} />
        <div className="flex items-center justify-between gap-3">
          <p className={clsx("text-xs", state ? (state.ok ? "text-emerald-700" : "text-red-600") : "text-faint")}>{state?.message ?? blocked ?? (channel === "sms" ? "Sent from (725) 666-1558" : "Sent from the inbox in this thread")}</p>
          <button className={btnCls} disabled={busy || !!blocked}>{busy ? "Sending…" : "Send"}</button>
        </div>
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { clsx } from "clsx";
import { testAssistant, type TestState } from "@/app/crm/actions";
import { btnCls, inputCls } from "./ui";

export function AssistantTest() {
  const [state, action, busy] = useActionState<TestState, FormData>(testAssistant, null);
  return (
    <form action={action} className="space-y-3">
      <div className="flex gap-2">
        <select name="channel" defaultValue="sms" className={clsx(inputCls, "w-28")}>
          <option value="sms">Text</option>
          <option value="email">Email</option>
        </select>
        <input name="message" placeholder='Try: "how much do you pay?" or "yes interested, 5 yrs OTR"' className={inputCls} />
        <button className={btnCls} disabled={busy}>{busy ? "Thinking…" : "Test"}</button>
      </div>
      {state && (
        <div className="space-y-2 rounded-[6px] border border-white/10 bg-white/[0.02] p-3 text-sm">
          {state.error && <p className="text-red-300">{state.error}</p>}
          {state.action && <p className="text-xs text-white/45">Result: {state.action} · {state.channel}{state.cost ? ` · $${state.cost.toFixed(4)}` : ""}</p>}
          {state.reply && <p className="whitespace-pre-wrap rounded-[6px] border border-signal/25 bg-signal/[0.06] p-3 text-white/90">{state.reply}</p>}
          {state.problems?.length ? <p className="text-xs text-dusk">Checks: {state.problems.join("; ")}</p> : null}
          {state.json && (
            <details>
              <summary className="cursor-pointer text-xs text-white/45">Full decision (memory, stage, follow-up)</summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-white/60">{state.json}</pre>
            </details>
          )}
        </div>
      )}
    </form>
  );
}

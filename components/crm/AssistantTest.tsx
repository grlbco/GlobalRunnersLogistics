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
        <div className="space-y-2 rounded-[14px] border border-line bg-subtle p-3 text-sm">
          {state.error && <p className="text-red-600">{state.error}</p>}
          {state.action && <p className="text-xs text-faint">Result: {state.action} · {state.channel}{state.cost ? ` · $${state.cost.toFixed(4)}` : ""}</p>}
          {state.reply && <p className="whitespace-pre-wrap rounded-[16px] rounded-tr-[4px] border border-navy/10 bg-navy-soft p-3 text-fg">{state.reply}</p>}
          {state.problems?.length ? <p className="text-xs text-[#8a4f0e]">Checks: {state.problems.join("; ")}</p> : null}
          {state.json && (
            <details>
              <summary className="cursor-pointer text-xs text-faint">Full decision (memory, stage, follow-up)</summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-muted">{state.json}</pre>
            </details>
          )}
        </div>
      )}
    </form>
  );
}

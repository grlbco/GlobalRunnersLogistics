import { giveAnswer } from "@/app/crm/actions";
import { btnGhostCls, inputCls } from "./ui";

/** The assistant was missing a fact: give it here, it answers the driver and carries on, and this hands the driver back to it. */
export function GiveAnswer({ contactId }: { contactId: string }) {
  return (
    <form action={giveAnswer} className="flex gap-2">
      <input type="hidden" name="id" value={contactId} />
      <input name="answer" required maxLength={500} aria-label="Give the assistant the answer" placeholder="Give the assistant the answer, it replies and carries on…" className={inputCls} />
      <button className={`${btnGhostCls} shrink-0`}>Give answer</button>
    </form>
  );
}

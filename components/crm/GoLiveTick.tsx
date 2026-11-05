"use client";

import { useTransition } from "react";
import { clsx } from "clsx";
import { toggleGoLive } from "@/app/crm/settings/actions";

export function GoLiveTick({ item, done }: { item: string; done: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      aria-label={done ? "Mark not done" : "Mark done"}
      disabled={pending}
      onClick={() => start(async () => void (await toggleGoLive(item, !done)))}
      className={clsx("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] text-[10px]", done ? "bg-emerald-500 text-white" : "border border-line-strong hover:border-fg")}
    >
      {done ? "✓" : ""}
    </button>
  );
}

"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { clsx } from "clsx";
import { moveContact } from "@/app/crm/actions";

type Card = { id: string; name: string; company: string | null; place: string; when: string };
type Col = { stage: string; label: string; count: number; items: Card[] };

/** Kanban with native drag and drop; moves are optimistic and saved as stage changes. */
export function Board({ columns }: { columns: Col[] }) {
  const [cols, move] = useOptimistic(columns, (state, { id, to }: { id: string; to: string }) => {
    let card: Card | undefined;
    const next = state.map((c) => {
      const hit = c.items.find((i) => i.id === id);
      if (hit) card = hit;
      return hit ? { ...c, count: c.count - 1, items: c.items.filter((i) => i.id !== id) } : c;
    });
    return next.map((c) => (c.stage === to && card ? { ...c, count: c.count + 1, items: [card, ...c.items] } : c));
  });
  const [, start] = useTransition();
  const [over, setOver] = useState<string | null>(null);

  return (
    <div className="flex gap-4 overflow-x-auto p-5 md:p-8">
      {cols.map((col) => (
        <section
          key={col.stage}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(col.stage);
          }}
          onDragLeave={() => setOver((o) => (o === col.stage ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            setOver(null);
            const id = e.dataTransfer.getData("text/plain");
            const from = e.dataTransfer.getData("application/x-stage");
            if (!id || from === col.stage) return;
            start(async () => {
              move({ id, to: col.stage });
              await moveContact(id, col.stage);
            });
          }}
          className={clsx("flex w-72 shrink-0 flex-col rounded-[6px] border bg-white/[0.015] transition-colors", over === col.stage ? "border-signal/60 bg-signal/[0.04]" : "border-white/[0.07]")}
        >
          <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <h2 className="text-sm font-medium">{col.label}</h2>
            <span className="font-mono text-xs text-white/45">{col.count.toLocaleString("en-US")}</span>
          </header>
          <ul className="flex max-h-[72vh] min-h-24 flex-col gap-2 overflow-y-auto p-2">
            {col.items.map((c) => (
              <li
                key={c.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", c.id);
                  e.dataTransfer.setData("application/x-stage", col.stage);
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="cursor-grab active:cursor-grabbing"
              >
                <Link href={`/crm/contacts/${c.id}`} draggable={false} className="block rounded-[4px] border border-white/[0.07] bg-ink p-3 transition-colors hover:border-white/25">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="truncate text-xs text-white/45">{c.company}</p>
                  <div className="mt-2 flex justify-between text-[0.7rem] text-white/40"><span>{c.place}</span><span>{c.when}</span></div>
                </Link>
              </li>
            ))}
            {col.items.length === 0 && <li className="px-2 py-6 text-center text-xs text-white/30">Drop here</li>}
          </ul>
        </section>
      ))}
    </div>
  );
}

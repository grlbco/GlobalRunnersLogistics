"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import { moveContact } from "@/app/crm/actions";
import { stageTone, toneDot } from "@/lib/crm/stages";
import { Avatar } from "./ui";
import { EASE } from "./motion";

type Card = { id: string; name: string; company: string | null; place: string; when: string; email: string | null; phone: string | null; tier: number | null; application?: string | null };
type Col = { stage: string; label: string; count: number; items: Card[] };

const MailIcon = () => <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 6h16v12H4zM4 7l8 6 8-6" /></svg>;
const PhoneIcon = () => <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6.5 4h3l1.5 4-2 1.2a10 10 0 0 0 5.8 5.8L16 13l4 1.5v3A2 2 0 0 1 18 19.5 15.5 15.5 0 0 1 4.5 6 2 2 0 0 1 6.5 4z" /></svg>;

const FormIcon = () => <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" /></svg>;

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
  const [dragging, setDragging] = useState<string | null>(null);

  return (
    <div className="flex gap-3 overflow-x-auto px-5 pb-2 md:px-6">
      {cols.map((col) => (
        <section
          key={col.stage}
          onDragOver={(e) => { e.preventDefault(); setOver(col.stage); }}
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
          className={clsx(
            "flex w-[17.5rem] shrink-0 flex-col rounded-[16px] border transition-all duration-200",
            over === col.stage ? "border-fg bg-subtle shadow-[0_0_0_3px_var(--color-line-strong)]" : "border-line bg-surface",
          )}
        >
          <header className="flex items-center justify-between px-3.5 pb-2 pt-3">
            <h2 className="flex items-center gap-2 text-[0.875rem] font-medium tracking-[-0.01em]">
              <span className={clsx("h-2 w-2 rounded-full", toneDot[stageTone(col.stage)])} />
              {col.label}
            </h2>
            <span className="rounded-[7px] bg-hover px-1.5 py-0.5 text-[0.72rem] font-medium tabular-nums text-muted">{col.count.toLocaleString("en-US")}</span>
          </header>
          <ul className="flex max-h-[calc(100dvh-13rem)] min-h-28 flex-col gap-2 overflow-y-auto p-2 pt-1">
            <AnimatePresence initial={false}>
              {col.items.map((c) => (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: dragging === c.id ? 0.4 : 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.25, ease: EASE }}
                >
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", c.id);
                      e.dataTransfer.setData("application/x-stage", col.stage);
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(c.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className="relative cursor-grab active:cursor-grabbing"
                  >
                  <Link href={`/crm/contacts/${c.id}`} draggable={false} className={clsx("group block rounded-[12px] border border-line bg-subtle p-3 transition-[border-color,transform,background-color] duration-150 hover:-translate-y-px hover:border-line-strong hover:bg-surface", c.application && "pb-12")}>
                    <div className="flex items-start gap-2.5">
                      <Avatar name={c.name} className="h-7 w-7 text-[0.65rem]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.84rem] font-medium leading-tight">{c.name}</p>
                        <p className="mt-0.5 truncate text-[0.72rem] text-faint">{c.when}{c.place && ` · ${c.place}`}</p>
                      </div>
                      {c.tier && <span className="rounded-[5px] border border-line px-1.5 py-px font-mono text-[0.62rem] text-faint">T{c.tier}</span>}
                    </div>
                    {(c.email || c.phone || c.company) && (
                      <div className="mt-2.5 space-y-1 border-t border-line pt-2.5 text-[0.75rem] text-muted">
                        {c.company && <p className="truncate font-medium text-fg-2">{c.company}</p>}
                        {c.email && <p className="flex items-center gap-1.5 truncate"><MailIcon /><span className="truncate">{c.email}</span></p>}
                        {c.phone && <p className="flex items-center gap-1.5"><PhoneIcon />{c.phone}</p>}
                      </div>
                    )}
                  </Link>
                  {c.application && (
                    <a
                      href={`/crm/applications/${c.application}`}
                      target="_blank"
                      rel="noopener"
                      draggable={false}
                      title="Open the submitted application in a new window"
                      className="absolute inset-x-3 bottom-2.5 flex h-7 items-center justify-center gap-1.5 rounded-[8px] border border-line bg-surface text-[0.75rem] font-medium text-fg-2 transition-colors hover:border-fg hover:text-fg"
                    >
                      <FormIcon /> Application
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M14 4h6v6M20 4l-9 9" /></svg>
                    </a>
                  )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
            {col.items.length === 0 && <li className="rounded-[12px] border border-dashed border-line-strong px-2 py-8 text-center text-[0.75rem] text-faint">Drop a card here</li>}
          </ul>
        </section>
      ))}
    </div>
  );
}

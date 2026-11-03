"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";

/**
 * Keeps CRM screens live: refreshes on new messages/contact changes (Supabase Realtime).
 * In local dev it also runs the background tick every 20 s, since there's no cron on your PC.
 */
export function LiveSync({ dev }: { dev: boolean }) {
  const router = useRouter();
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(() => router.refresh(), 400);
    };
    const sb = browserClient();
    const ch = sb
      .channel("crm-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "contacts" }, refresh)
      .subscribe((status: string) => {
        if (status !== "SUBSCRIBED") console.warn("[crm] live updates:", status);
      });
    let timer: ReturnType<typeof setInterval> | undefined;
    if (dev) {
      // After each sync, refresh if it brought anything new (covers Realtime being unavailable).
      const tick = () =>
        fetch("/api/worker/tick", { cache: "no-store" })
          .then((r) => r.json())
          .then((j) => {
            if ((j?.sync?.quo?.newMessages ?? 0) + (j?.sync?.instantly?.newMessages ?? 0) + (j?.sent?.length ?? 0) > 0) refresh();
          })
          .catch(() => {});
      tick();
      timer = setInterval(tick, 20_000);
    }
    return () => {
      sb.removeChannel(ch);
      if (timer) clearInterval(timer);
      if (pending.current) clearTimeout(pending.current);
    };
  }, [router, dev]);

  return null;
}

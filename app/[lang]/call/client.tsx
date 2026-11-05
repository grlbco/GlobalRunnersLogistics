"use client";

import { useSyncExternalStore } from "react";
import { CallMeNow } from "@/components/forms/CallMeNow";

const readToken = () => {
  const t = new URLSearchParams(window.location.search).get("t");
  return t && /^[0-9a-f]{24}$/.test(t) ? t : "";
};

export function CallPageClient() {
  const token = useSyncExternalStore(() => () => {}, readToken, () => "");
  return <CallMeNow key={token} token={token || null} source="call_page" />;
}

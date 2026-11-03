"use client";

import { useEffect } from "react";
import { markRead } from "@/app/crm/actions";

export function MarkRead({ contactId, unread }: { contactId: string; unread: boolean }) {
  useEffect(() => {
    if (unread) markRead(contactId);
  }, [contactId, unread]);
  return null;
}

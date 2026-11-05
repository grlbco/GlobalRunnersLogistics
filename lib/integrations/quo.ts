import "server-only";
import crypto from "node:crypto";
import { callJson } from "./http";

/** Quo (formerly OpenPhone) public API v1. Raw API key in Authorization. */
const BASE = "https://api.openphone.com/v1";
const key = () => {
  const k = process.env.QUO_API_KEY;
  if (!k) throw new Error("QUO_API_KEY is not set");
  return k;
};
const get = <T>(path: string) => callJson<T>("quo", `${BASE}${path}`, { headers: { Authorization: key() } });

export type QuoMessage = { id: string; from: string; to: string[]; text: string; direction: "incoming" | "outgoing"; status?: string; createdAt: string; conversationId?: string; phoneNumberId?: string; userId?: string };
export type QuoConversation = { id: string; participants: string[]; phoneNumberId: string; lastActivityAt?: string; updatedAt?: string };

export const fromNumber = () => process.env.QUO_FROM_NUMBER ?? "";

let phoneIdCache: string | null = null;
export async function phoneNumberId(): Promise<string> {
  if (phoneIdCache) return phoneIdCache;
  const r = await get<{ data: { id: string; number: string }[] }>("/phone-numbers");
  const hit = r.data.find((p) => p.number === fromNumber()) ?? r.data[0];
  if (!hit) throw new Error("No Quo phone number found");
  phoneIdCache = hit.id;
  return hit.id;
}

/** Conversations on our number with activity after `since`. */
export async function conversationsSince(since: string): Promise<QuoConversation[]> {
  const out: QuoConversation[] = [];
  let token: string | undefined;
  for (let i = 0; i < 10; i++) {
    const q = new URLSearchParams({ maxResults: "100", updatedAfter: since });
    q.append("phoneNumbers[]", fromNumber());
    if (token) q.set("pageToken", token);
    const r = await get<{ data: QuoConversation[]; nextPageToken?: string | null }>(`/conversations?${q}`);
    out.push(...(r.data ?? []));
    if (!r.nextPageToken) break;
    token = r.nextPageToken;
  }
  return out;
}

export async function messagesWith(participant: string, since: string): Promise<QuoMessage[]> {
  const q = new URLSearchParams({ phoneNumberId: await phoneNumberId(), maxResults: "100", createdAfter: since });
  q.append("participants[]", participant);
  const r = await get<{ data: QuoMessage[] }>(`/messages?${q}`);
  return r.data ?? [];
}

export async function sendText(to: string, content: string): Promise<{ id?: string }> {
  const r = await callJson<{ data?: { id?: string } }>("quo", `${BASE}/messages`, {
    method: "POST",
    headers: { Authorization: key(), "Content-Type": "application/json" },
    body: JSON.stringify({ content, from: fromNumber(), to: [to] }),
    retries: 0, // never risk a double send
  });
  return { id: r.data?.id };
}

// ---------------- calls (API version 2026-03-30: summaries + voicemail in one call) ----------------

export type QuoCall = {
  id: string;
  phoneNumberId: string | null;
  direction: "incoming" | "outgoing";
  status: string;
  participants: { phoneNumber: string; actorId: string | null }[];
  answeredAt: string | null;
  answeredBy: string | null;
  completedAt: string | null;
  createdAt: string;
  duration: number;
  aiHandled: string | null;
  summary?: { status: string; type: string | null; summary: string[] | null; nextSteps: string[] | null; title: string | null } | null;
  voicemail?: { id: string; status: string; duration: number | null; recordingUrl: string | null; transcript: string | null } | null;
};
const V2 = "https://api.quo.com";
const getV2 = <T>(path: string) => callJson<T>("quo", `${V2}${path}`, { headers: { Authorization: key(), "Quo-Api-Version": "2026-03-30" } });

/** Calls on our number since `since` (newest first), with summary + voicemail. */
export async function callsSince(since: string): Promise<QuoCall[]> {
  const out: QuoCall[] = [];
  let after: string | undefined;
  const pn = await phoneNumberId();
  for (let i = 0; i < 6; i++) {
    const q = new URLSearchParams({ include: "summary,voicemail", phoneNumberId: pn, "createdAt[gte]": since, limit: "50" });
    if (after) q.set("after", after);
    const r = await getV2<{ data: QuoCall[]; nextCursor?: string | null }>(`/calls?${q}`);
    out.push(...(r.data ?? []));
    if (!r.nextCursor) break;
    after = r.nextCursor;
  }
  return out;
}

export async function getCall(id: string): Promise<QuoCall | null> {
  if (!/^AC/.test(id)) return null;
  const r = await getV2<{ data: QuoCall }>(`/calls/${id}?include=summary,voicemail`).catch(() => null);
  return r?.data ?? null;
}

/** Call id from any call.* webhook (v1 or newer envelopes). */
export function callIdFromEvent(body: unknown): string | null {
  const b = body as { data?: { object?: Record<string, unknown>; resource?: Record<string, unknown> } };
  const o = b?.data?.object ?? b?.data?.resource ?? {};
  const id = (o.callId ?? (String(o.id ?? "").startsWith("AC") ? o.id : null)) as string | null;
  return id && /^AC/.test(id) ? id : null;
}

/** Webhook payload → message (legacy data.object and newer data.resource envelopes). */
export function parseQuoEvent(body: unknown): { type: string; message?: QuoMessage } {
  const b = body as { type?: string; data?: { object?: Record<string, unknown>; resource?: Record<string, unknown>; context?: Record<string, unknown> } };
  const type = b?.type ?? "";
  const o = b?.data?.object ?? b?.data?.resource;
  if (!o) return { type };
  const c = b?.data?.context ?? {};
  const to = (o.to ?? c.recipientIdentifiers) as string[] | string | undefined;
  return {
    type,
    message: {
      id: String(o.id),
      from: String(o.from ?? c.senderIdentifier ?? ""),
      to: Array.isArray(to) ? to : to ? [to] : [],
      text: String(o.text ?? o.body ?? ""),
      direction: (o.direction as QuoMessage["direction"]) ?? "incoming",
      status: o.status as string | undefined,
      createdAt: String(o.createdAt ?? new Date().toISOString()),
      conversationId: (o.conversationId ?? c.conversationId) as string | undefined,
    },
  };
}

const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Verifies `webhook-signature` (current) or `openphone-signature` (legacy). */
export function verifyQuoSignature(raw: string, h: Headers): boolean {
  const secret = process.env.QUO_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const keyBuf = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const id = h.get("webhook-id");
  const ts = h.get("webhook-timestamp");
  const sig = h.get("webhook-signature");
  if (id && ts && sig) {
    if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
    const expected = crypto.createHmac("sha256", keyBuf).update(`${id}.${ts}.${raw}`).digest("base64");
    return sig.split(" ").some((part) => safeEq(part.split(",")[1] ?? "", expected));
  }
  const legacy = h.get("openphone-signature");
  if (legacy) {
    const [, , lts, lsig] = legacy.split(";");
    const expected = crypto.createHmac("sha256", keyBuf).update(`${lts}.${raw}`).digest("base64");
    return safeEq(lsig ?? "", expected);
  }
  return false;
}

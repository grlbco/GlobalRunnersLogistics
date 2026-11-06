import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./stubs/fakeDb";

/** The real worker code, run against an in-memory database and an AI that can be told to fail. */
const h = vi.hoisted(() => ({ db: null as unknown as FakeDb, ai: vi.fn(), sms: vi.fn(), email: vi.fn(), alerts: [] as string[] }));

vi.mock("@/lib/crm/admin", () => ({ adminDb: () => h.db }));
vi.mock("@/lib/integrations/deepseek", async (orig) => ({ ...(await orig<object>()), chatJson: h.ai, chatText: h.ai }));
vi.mock("@/lib/integrations/telegram", () => ({ sendTelegram: async (t: string) => { h.alerts.push(t); return true; }, esc: (s: unknown) => String(s) }));
vi.mock("@/lib/crm/notify", () => ({ notifyTeam: async () => {} }));
vi.mock("@/lib/integrations/quo", () => ({ sendText: h.sms, fromNumber: () => "+17256661558" }));
vi.mock("@/lib/integrations/instantly", () => ({ replyToEmail: h.email, listEmails: async () => ({ items: [] }) }));
vi.mock("@/lib/crm/callme", () => ({ getCallHours: async () => ({}), inCallHours: () => true, requestCall: async () => {} }));

import { processAgentQueue } from "@/lib/agent/engine";
import { sweepStuck } from "@/lib/agent/rescue";
import { factsVersion } from "@/lib/agent/versions";
import { DISCLOSURE_TEXT } from "@/lib/agent/fixed";
import { ApiError } from "@/lib/integrations/http";
import { moveStage, type Contact } from "@/lib/crm/ingest";
import { processRow } from "@/lib/crm/outbox";
import { handleInstantlyStatus } from "@/lib/crm/sync";
import { clearSendingCache } from "@/lib/crm/sending";

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const MIN = 60_000;
const ID = "driver-1";

const aiSays = (d: Record<string, unknown>) => ({ content: JSON.stringify({ intent: "interested", replies: ["sounds good"], facts: {}, ...d }), finish: "stop", model: "test", tokensIn: 1, tokensOut: 1, costUsd: 0, latencyMs: 1 });
const table = (t: string) => h.db.rows(t) as Record<string, unknown>[];
const contact = () => table("contacts").find((c) => c.id === ID)!;

function seedDriver(over: Record<string, unknown> = {}) {
  h.db.seed("contacts", { id: ID, first_name: "Luis", last_name: "Ortega", email: "luis@x.test", phone: "+17025550100", cell_phone: "+17025550100", stage: "replied", agent_mode: "auto", do_not_contact: false, sms_consent: true, email_consent: true, timezone: "America/Los_Angeles", ...over });
}
function driverWrote(body: string, channel = "sms") {
  const id = h.db.nextId();
  h.db.seed("messages", { id, contact_id: ID, channel, direction: "inbound", author: "lead", body, created_at: ago(5 * MIN), meta: {} });
  contact().last_inbound_at = ago(5 * MIN);
  h.db.seed("agent_runs", { contact_id: ID, trigger: channel === "sms" ? "text_received" : "email_received", input_message_id: id, action: "queued", created_at: ago(5 * MIN) });
}
const approveFacts = () => h.db.seed("app_settings", { key: "facts_approval", value: { version: factsVersion(), by: "Ken", at: ago(MIN) } });
const assistant = (v: Record<string, unknown> = {}) => h.db.seed("app_settings", { key: "assistant", value: { enabled: true, draft_mode: true, ...v } });

beforeEach(() => {
  h.db = new FakeDb();
  h.alerts.length = 0;
  h.ai.mockReset();
  h.sms.mockReset().mockResolvedValue({ id: "sms-1" });
  h.email.mockReset().mockResolvedValue({ id: "em-1" });
  process.env.SENDING_ENABLED = "true";
  clearSendingCache();
  assistant();
  seedDriver();
});

describe("when the AI fails, nobody is left waiting", () => {
  it("retries a temporary error, then gets a person after 3 tries", async () => {
    h.ai.mockRejectedValue(new ApiError("deepseek", 503, "down"));
    driverWrote("what trucks do you run");
    await processAgentQueue();
    expect(table("agent_runs").filter((r) => r.action === "queued")).toHaveLength(1);
    expect(table("tasks")).toHaveLength(0);
    await processAgentQueue();
    await processAgentQueue();
    expect(table("agent_runs").filter((r) => r.action === "queued")).toHaveLength(0);
    expect(table("tasks").filter((t) => String(t.title).startsWith("Driver waiting"))).toHaveLength(1);
    expect(h.alerts.some((a) => a.includes("Driver waiting"))).toBe(true);
  });
  it("gets a person at once on an empty balance, and doesn't retry", async () => {
    h.ai.mockRejectedValue(new ApiError("deepseek", 402, "insufficient balance"));
    driverWrote("what trucks do you run");
    await processAgentQueue();
    expect(table("agent_runs").filter((r) => r.action === "queued")).toHaveLength(0);
    expect(table("tasks")).toHaveLength(1);
  });
  it("queues a holding message that needs no AI", async () => {
    h.ai.mockRejectedValue(new ApiError("deepseek", 402, "insufficient balance"));
    driverWrote("what trucks do you run");
    await processAgentQueue();
    expect(table("outbox").some((o) => String(o.body).includes("will follow up"))).toBe(true);
  });
  it("hands a blank AI answer to a person", async () => {
    h.ai.mockResolvedValue({ content: "", finish: "stop", model: "test", tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 1 });
    driverWrote("what trucks do you run");
    await processAgentQueue();
    expect(table("tasks")).toHaveLength(1);
    expect(table("outbox")).toHaveLength(0);
  });
  it("a repeated failure opens one task, not many", async () => {
    h.ai.mockRejectedValue(new ApiError("deepseek", 402, "x"));
    driverWrote("one");
    await processAgentQueue();
    driverWrote("two");
    await processAgentQueue();
    expect(table("tasks").filter((t) => String(t.title).startsWith("Driver waiting"))).toHaveLength(1);
  });
});

describe("two workers running at once", () => {
  it("only one takes a driver's message", async () => {
    h.ai.mockResolvedValue(aiSays({}));
    driverWrote("tell me more");
    await Promise.all([processAgentQueue(), processAgentQueue()]);
    expect(h.ai).toHaveBeenCalledOnce();
  });
  it("only one takes a follow-up", async () => {
    h.ai.mockResolvedValue(aiSays({ intent: "other" }));
    h.db.seed("followups", { contact_id: ID, due_at: ago(MIN), attempt: 1, kind: "nudge", channel: "sms", status: "pending" });
    await Promise.all([processAgentQueue(), processAgentQueue()]);
    expect(h.ai).toHaveBeenCalledOnce();
  });
});

describe("follow-ups survive a crash", () => {
  const due = () => h.db.seed("followups", { contact_id: ID, due_at: ago(MIN), attempt: 1, kind: "nudge", channel: "sms", status: "pending" });
  it("comes back on its own after a temporary failure", async () => {
    h.ai.mockRejectedValue(new ApiError("deepseek", 500, "x"));
    due();
    await processAgentQueue();
    const f = table("followups")[0];
    expect(f.status).toBe("pending");
    expect(String(f.due_at) > new Date().toISOString()).toBe(true);
  });
  it("isn't run twice while it's claimed", async () => {
    h.ai.mockRejectedValue(new ApiError("deepseek", 500, "x"));
    due();
    await processAgentQueue();
    h.ai.mockClear();
    await processAgentQueue();
    expect(h.ai).not.toHaveBeenCalled();
  });
  it("is done after it succeeds, with the next one planned", async () => {
    h.ai.mockResolvedValue(aiSays({ intent: "other", replies: ["still looking?"] }));
    due();
    await processAgentQueue();
    expect(table("followups").filter((f) => f.status === "pending").length).toBe(1);
    expect(table("followups")[0].status).not.toBe("pending");
  });
});

describe("what goes out", () => {
  it("drafts when the facts aren't approved, even with draft mode off", async () => {
    table("app_settings").find((s) => s.key === "assistant")!.value = { enabled: true, draft_mode: false };
    h.ai.mockResolvedValue(aiSays({}));
    driverWrote("tell me more");
    await processAgentQueue();
    expect(table("outbox").length).toBeGreaterThan(0);
    expect(table("outbox").every((o) => o.status === "draft")).toBe(true);
  });
  it("sends once facts are approved and draft mode is off", async () => {
    table("app_settings").find((s) => s.key === "assistant")!.value = { enabled: true, draft_mode: false };
    approveFacts();
    h.ai.mockResolvedValue(aiSays({}));
    driverWrote("tell me more");
    await processAgentQueue();
    expect(table("outbox").every((o) => o.status === "pending")).toBe(true);
  });
  it("says it's AI in the first text only", async () => {
    h.ai.mockResolvedValue(aiSays({}));
    driverWrote("tell me more");
    await processAgentQueue();
    expect(table("outbox").some((o) => o.body === DISCLOSURE_TEXT)).toBe(true);
    table("outbox").length = 0;
    h.db.seed("messages", { contact_id: ID, channel: "sms", direction: "outbound", author: "agent", body: "earlier", created_at: ago(4 * MIN), meta: {} });
    driverWrote("and the trucks?");
    table("messages").at(-1)!.created_at = ago(3 * MIN);
    await processAgentQueue();
    expect(table("outbox").some((o) => o.body === DISCLOSURE_TEXT)).toBe(false);
  });
  it("answers pay in code, without calling the AI", async () => {
    driverWrote("how much u pay");
    await processAgentQueue();
    expect(h.ai).not.toHaveBeenCalled();
    expect(table("outbox").some((o) => String(o.body).includes("per mile"))).toBe(true);
  });
  it("records which prompt and facts wrote it", async () => {
    h.ai.mockResolvedValue(aiSays({}));
    driverWrote("tell me more");
    await processAgentQueue();
    const run = table("agent_runs").find((r) => r.action === "draft");
    expect((run?.checks as { facts_version?: string }).facts_version).toBe(factsVersion());
  });
  it("sends legal words straight to a person, before the AI", async () => {
    driverWrote("my lawyer will call you");
    await processAgentQueue();
    expect(h.ai).not.toHaveBeenCalled();
    expect(table("tasks")).toHaveLength(1);
    expect(table("outbox")).toHaveLength(0);
  });
  it("sends an approved draft, and drops an AI message a person has overtaken", async () => {
    const send = async (over: Record<string, unknown>) => {
      const id = h.db.nextId();
      h.db.seed("outbox", { id, contact_id: ID, channel: "sms", author: "agent", author_id: null, subject: null, body: "hi", status: "pending", attempts: 0, is_reply: false, send_after: ago(1000), created_at: ago(1000), ...over });
      return id;
    };
    contact().agent_mode = "manual";
    const dropped = await processRow(await send({}));
    expect(dropped.ok).toBe(false);
    expect(table("outbox").at(-1)!.status).toBe("cancelled");
    expect(h.sms).not.toHaveBeenCalled();
    const sent = await processRow(await send({ author_id: "staff-1", is_reply: true }));
    expect(sent.ok).toBe(true);
    expect(h.sms).toHaveBeenCalledOnce();
  });
  it("never sends while sending is switched off", async () => {
    process.env.SENDING_ENABLED = "false";
    clearSendingCache();
    const id = h.db.nextId();
    h.db.seed("outbox", { id, contact_id: ID, channel: "sms", author: "human", author_id: "s", subject: null, body: "hi", status: "pending", attempts: 0, is_reply: true, send_after: ago(1000), created_at: ago(1000) });
    await processRow(id);
    expect(h.sms).not.toHaveBeenCalled();
  });
});

describe("closed and handled drivers reach a person, not the AI", () => {
  it.each([["unsubscribed", true], ["not_fit", false], ["not_interested", false]])("%s writing back opens a task", async (stage, dnc) => {
    contact().stage = stage;
    contact().do_not_contact = dnc;
    driverWrote("actually I changed my mind");
    await processAgentQueue();
    expect(h.ai).not.toHaveBeenCalled();
    expect(table("tasks").some((t) => String(t.title).includes("file was closed"))).toBe(true);
    expect(table("outbox")).toHaveLength(0);
  });
  it("a driver writing during a takeover tells the person, once", async () => {
    contact().agent_mode = "manual";
    driverWrote("you there?");
    await processAgentQueue();
    driverWrote("hello?");
    await processAgentQueue();
    expect(h.ai).not.toHaveBeenCalled();
    expect(table("tasks").filter((t) => String(t.title).includes("while you were handling"))).toHaveLength(1);
  });
});

describe("Instantly interested starts the AI", () => {
  const event = { event_type: "lead_interested", lead_email: "luis@x.test", campaign_id: "c1", timestamp: "2026-11-06T10:00:00Z" };
  it("queues the assistant and moves the card when there's no reply to read", async () => {
    contact().stage = "contacted";
    await handleInstantlyStatus(event);
    expect(contact().stage).toBe("interested");
    expect(table("agent_runs").filter((r) => r.trigger === "interest_label" && r.action === "queued")).toHaveLength(1);
  });
  it("ignores the same event sent twice", async () => {
    await handleInstantlyStatus(event);
    await handleInstantlyStatus(event);
    expect(table("agent_runs").filter((r) => r.trigger === "interest_label")).toHaveLength(1);
  });
  it("a retried event doesn't restart a finished run", async () => {
    await handleInstantlyStatus(event);
    table("agent_runs")[0].action = "no_reply";
    await handleInstantlyStatus(event);
    expect(table("agent_runs").filter((r) => r.trigger === "interest_label")).toHaveLength(1);
    expect(table("events")).toHaveLength(1);
  });
  it("a later, different event still counts", async () => {
    await handleInstantlyStatus(event);
    table("agent_runs")[0].action = "no_reply";
    await handleInstantlyStatus({ ...event, timestamp: "2026-11-07T10:00:00Z" });
    expect(table("agent_runs").filter((r) => r.trigger === "interest_label")).toHaveLength(2);
  });
  it("doesn't double up when an answer is already on its way", async () => {
    driverWrote("yes interested");
    await handleInstantlyStatus(event);
    expect(table("agent_runs").filter((r) => r.trigger === "interest_label")).toHaveLength(0);
  });
  it("leaves the card for the AI when there are words to read", async () => {
    contact().stage = "contacted";
    h.db.seed("messages", { contact_id: ID, channel: "email", direction: "inbound", author: "lead", body: "sure", created_at: ago(MIN), meta: {} });
    await handleInstantlyStatus(event);
    expect(contact().stage).toBe("contacted");
    expect(table("agent_runs").some((r) => r.trigger === "interest_label")).toBe(true);
  });
  it("the assistant then moves the card, with the driver's words as proof", async () => {
    contact().stage = "contacted";
    h.db.seed("messages", { contact_id: ID, channel: "email", direction: "inbound", author: "lead", body: "yeah sounds good", created_at: ago(5 * MIN), meta: {} });
    await handleInstantlyStatus(event);
    h.ai.mockResolvedValue(aiSays({ stage: "interested", stage_quote: "sounds good" }));
    await processAgentQueue();
    expect(contact().stage).toBe("interested");
    expect(table("stage_events").some((e) => e.actor_type === "ai" && e.decision === "applied" && e.evidence_quote === "sounds good")).toBe(true);
  });
  it("a made-up quote doesn't move the card, and is recorded", async () => {
    contact().stage = "contacted";
    h.db.seed("messages", { contact_id: ID, channel: "email", direction: "inbound", author: "lead", body: "maybe", created_at: ago(5 * MIN), meta: {} });
    await handleInstantlyStatus(event);
    h.ai.mockResolvedValue(aiSays({ stage: "interested", stage_quote: "I want this job" }));
    await processAgentQueue();
    expect(contact().stage).toBe("contacted");
    expect(table("stage_events").some((e) => e.decision === "rejected")).toBe(true);
  });
  it("marked not interested stops everything planned", async () => {
    h.db.seed("followups", { contact_id: ID, due_at: ago(-MIN), attempt: 1, kind: "nudge", channel: "sms", status: "pending" });
    await handleInstantlyStatus({ ...event, event_type: "lead_not_interested" });
    expect(table("followups")[0].status).toBe("cancelled");
    expect(contact().stage).toBe("not_interested");
  });
});

describe("a person's move sticks", () => {
  const c = () => contact() as unknown as Contact;
  it("the AI can't move a locked card", async () => {
    contact().stage_locked_at = ago(MIN);
    await moveStage(c(), "interested", "agent", {}, { quote: "yes", driverText: "yes" });
    expect(contact().stage).toBe("replied");
    expect(table("stage_events").some((e) => e.decision === "rejected")).toBe(true);
  });
  it("a finished form still moves it", async () => {
    contact().stage_locked_at = ago(MIN);
    await moveStage(c(), "applied", "website");
    expect(contact().stage).toBe("applied");
  });
  it("records every move", async () => {
    await moveStage(c(), "applied", "website", {}, { reason: "Driver submitted the form" });
    expect(table("stage_events")[0]).toMatchObject({ from_stage: "replied", to_stage: "applied", actor_type: "system", decision: "applied" });
  });
});

describe("the sweeper catches what fell through", () => {
  const unanswered = (mins = 20) => { contact().last_inbound_at = ago(mins * MIN); h.db.seed("messages", { contact_id: ID, channel: "sms", direction: "inbound", author: "lead", body: "hi", created_at: ago(mins * MIN), meta: {} }); };
  it("opens a task for a driver nobody answered", async () => {
    unanswered();
    expect((await sweepStuck()).rescued).toBe(1);
    expect(table("tasks")).toHaveLength(1);
  });
  it("only once", async () => {
    unanswered();
    await sweepStuck();
    expect((await sweepStuck()).rescued).toBe(0);
  });
  it("leaves a driver with a draft waiting alone", async () => {
    unanswered();
    h.db.seed("outbox", { contact_id: ID, channel: "sms", author: "agent", body: "x", status: "draft", send_after: ago(MIN) });
    expect((await sweepStuck()).rescued).toBe(0);
  });
  it("ignores a recent message", async () => {
    unanswered(5);
    expect((await sweepStuck()).rescued).toBe(0);
  });
  it("marks a run a crashed worker left behind", async () => {
    h.db.seed("agent_runs", { contact_id: ID, trigger: "text_received", action: "running", created_at: ago(30 * MIN) });
    expect((await sweepStuck()).staleRuns).toBe(1);
  });
  it("flags an interrupted send and doesn't resend it", async () => {
    h.db.seed("outbox", { contact_id: ID, channel: "sms", author: "agent", body: "x", status: "sending", send_after: ago(30 * MIN) });
    expect((await sweepStuck()).interruptedSends).toBe(1);
    expect(table("outbox")[0].status).toBe("failed");
    expect(h.sms).not.toHaveBeenCalled();
  });
  it("alerts when a live campaign has gone silent, once a day", async () => {
    h.db.seed("campaigns", { status: "active" });
    await sweepStuck();
    await sweepStuck();
    expect(h.alerts.filter((a) => a.includes("gone quiet"))).toHaveLength(1);
  });
});

import { it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { checkReply } from "@/lib/agent/checks";
import { advance } from "@/lib/crm/ingest";
import { BOARD, stageLabel } from "@/lib/crm/stages";

const url = "globalrunnerslogistics.com/a/PezbZ5";
it("call-list replies pass the reply checks", () => {
  for (const t of ["no problem, one of our team members will give you a call soon", "if you'd rather call us first, our number is 844-GLORUN1 (844) 456-7861"])
    expect(checkReply(t, { channel: "sms", formUrl: url }).problems, t).toEqual([]);
  const email = "Hey Bogdan, no problem at all.\n\nOne of our team members will give you a call soon. If you'd rather call us first, our number is 844-GLORUN1 (844) 456-7861.\n\nClaudia\nGlobal Runners Logistics";
  expect(checkReply(email, { channel: "email", formUrl: url }).problems).toEqual([]);
});
it("To call sits after Form sent and before Applied", () => {
  expect(stageLabel("to_call")).toBe("To call");
  expect(BOARD.indexOf("to_call")).toBeGreaterThan(BOARD.indexOf("form_sent"));
  expect(BOARD.indexOf("to_call")).toBeLessThan(BOARD.indexOf("applied"));
  expect(advance("form_sent", "to_call")).toBe("to_call");
  expect(advance("chasing", "to_call")).toBe("to_call");
  expect(advance("to_call", "form_sent")).toBe("to_call");
  expect(advance("to_call", "applied")).toBe("applied");
});

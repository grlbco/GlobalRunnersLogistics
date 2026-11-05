import { describe, expect, it } from "vitest";
import { PERM_KEYS, effectivePerms, homeFor, safeNext } from "@/lib/crm/permissions";
import { beyondActor, managersAfter, overridesFor, roleKeyFrom, type MemberRow, type RoleRow } from "@/lib/crm/team-rules";

const roles: RoleRow[] = [
  { key: "admin", name: "Admin", permissions: ["*"] },
  { key: "recruiter", name: "Recruiter", permissions: ["dashboard.view", "inbox.view", "contacts.view", "contacts.edit"] },
  { key: "viewer", name: "Viewer", permissions: ["dashboard.view", "contacts.view"] },
];
const m = (id: string, crm_role: string | null, extra: Partial<MemberRow> = {}): MemberRow => ({
  id, crm_role, staff_status: "active", permissions_grant: [], permissions_deny: [], ...extra,
});

describe("effective permissions", () => {
  it("'*' means every permission", () => expect(effectivePerms(["*"])).toEqual(PERM_KEYS));
  it("role + extra − removed", () => {
    expect(effectivePerms(roles[1].permissions, ["reports.view"], ["contacts.edit"])).toEqual(["dashboard.view", "inbox.view", "contacts.view", "reports.view"]);
  });
  it("ignores unknown keys (a typo can't grant anything)", () => expect(effectivePerms(["contacts.view", "god.mode"], ["root"])).toEqual(["contacts.view"]));
  it("no role = nothing", () => expect(effectivePerms(null)).toEqual([]));
  it("removals beat the admin '*'", () => expect(effectivePerms(["*"], [], ["team.manage"])).not.toContain("team.manage"));
});

describe("where to land and where it's safe to go", () => {
  it("lands on the first section you can open", () => {
    expect(homeFor(["dashboard.view"])).toBe("/crm");
    expect(homeFor(["contacts.view"])).toBe("/crm/contacts");
    expect(homeFor([])).toBe("/crm/account");
  });
  it.each([["https://evil.com"], ["//evil.com"], ["/crm\\@evil"], ["/dashboard"], [null]])("rejects %s", (n) => expect(safeNext(n, "/crm")).toBe("/crm"));
  it("keeps in-app paths with query", () => expect(safeNext("/crm/forms/1?tab=submissions")).toBe("/crm/forms/1?tab=submissions"));
});

describe("team safety rules", () => {
  it("can't hand out what you don't have", () => {
    expect(beyondActor(["contacts.view", "team.manage"], ["contacts.view", "settings.manage"])).toEqual(["settings.manage"]);
    expect(beyondActor(effectivePerms(["*"]), PERM_KEYS)).toEqual([]);
  });
  it("counts who can still manage the team", () => {
    const team = [m("a", "admin"), m("b", "recruiter")];
    expect(managersAfter(team, roles)).toBe(1);
    expect(managersAfter(team, roles, { member: m("a", "recruiter") })).toBe(0);
    expect(managersAfter(team, roles, { member: m("a", "admin", { staff_status: "suspended" }) })).toBe(0);
    expect(managersAfter(team, roles, { member: m("b", "recruiter", { permissions_grant: ["team.manage"] }) })).toBe(2);
    expect(managersAfter(team, roles, { member: m("a", "admin", { permissions_deny: ["team.manage"] }) })).toBe(0);
    // a role edit that strips team.manage from everyone
    expect(managersAfter(team, roles, { roles: roles.map((r) => (r.key === "admin" ? { ...r, permissions: ["dashboard.view"] } : r)) })).toBe(0);
    // a brand-new member counts too
    expect(managersAfter(team, roles, { member: m("c", "admin") })).toBe(2);
  });
  it("stores a checklist as extras/removals relative to the role", () => {
    expect(overridesFor(roles[1].permissions, ["dashboard.view", "inbox.view", "contacts.view", "reports.view"])).toEqual({ grant: ["reports.view"], deny: ["contacts.edit"] });
    expect(overridesFor(roles[1].permissions, roles[1].permissions)).toEqual({ grant: [], deny: [] });
  });
  it("makes clean role keys", () => {
    expect(roleKeyFrom("Night Dispatcher")).toBe("night_dispatcher");
    expect(roleKeyFrom("2nd shift")).toMatch(/^[a-z][a-z0-9_]+$/);
    expect(roleKeyFrom("Équipe Spéciale!")).toBe("equipe_speciale");
  });
});

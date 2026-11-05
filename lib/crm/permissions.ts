/**
 * CRM permissions: the single list of what a staff member can be allowed to do.
 * Roles (table crm_roles) hold a set of these keys; '*' means all of them.
 * A person can also get extra keys (permissions_grant) or lose some (permissions_deny) on top of their role.
 * Pure module: safe to import from client components.
 */

export const PERMISSIONS = [
  { key: "dashboard.view", group: "Overview", label: "See the dashboard" },
  { key: "inbox.view", group: "Drivers", label: "See the inbox" },
  { key: "contacts.view", group: "Drivers", label: "See contacts and profiles" },
  { key: "contacts.edit", group: "Drivers", label: "Edit contacts, stages, notes, tasks, take over from the assistant" },
  { key: "contacts.message", group: "Drivers", label: "Send emails and texts, approve assistant drafts" },
  { key: "pipeline.view", group: "Drivers", label: "See the pipeline" },
  { key: "forms.view", group: "Forms", label: "See forms and submissions" },
  { key: "forms.manage", group: "Forms", label: "Create, edit and delete forms" },
  { key: "campaigns.view", group: "Outreach", label: "See campaigns and their numbers" },
  { key: "campaigns.manage", group: "Outreach", label: "Create, launch, pause campaigns and add leads" },
  { key: "automations.view", group: "Outreach", label: "See automations" },
  { key: "automations.manage", group: "Outreach", label: "Create, change and switch automations on/off" },
  { key: "assistant.view", group: "Assistant", label: "See the assistant and test it" },
  { key: "assistant.manage", group: "Assistant", label: "Change the assistant's settings, switch it on/off" },
  { key: "reports.view", group: "Reports", label: "See reports" },
  { key: "settings.view", group: "Settings", label: "See settings and connections" },
  { key: "settings.manage", group: "Settings", label: "Sending switch, Ken's call hours, costs, go-live checklist" },
  { key: "team.manage", group: "Team", label: "Add people, change roles and permissions, suspend access" },
] as const;

export type Perm = (typeof PERMISSIONS)[number]["key"];
export const PERM_KEYS = PERMISSIONS.map((p) => p.key) as Perm[];
export const isPerm = (k: string): k is Perm => (PERM_KEYS as string[]).includes(k);

/** Effective permissions = role permissions + extra grants − denies. '*' in the role expands to everything. */
export function effectivePerms(rolePerms: readonly string[] | null | undefined, grant: readonly string[] = [], deny: readonly string[] = []): Perm[] {
  const base = (rolePerms ?? []).includes("*") ? PERM_KEYS : (rolePerms ?? []).filter(isPerm);
  const set = new Set<Perm>([...base, ...grant.filter(isPerm)]);
  for (const d of deny) set.delete(d as Perm);
  return PERM_KEYS.filter((k) => set.has(k));
}

/** Where each CRM section lives and what it needs. The sidebar and the page guards both read this. */
export const SECTIONS: { href: string; label: string; perm: Perm }[] = [
  { href: "/crm", label: "Dashboard", perm: "dashboard.view" },
  { href: "/crm/inbox", label: "Inbox", perm: "inbox.view" },
  { href: "/crm/pipeline", label: "Pipeline", perm: "pipeline.view" },
  { href: "/crm/contacts", label: "Contacts", perm: "contacts.view" },
  { href: "/crm/forms", label: "Forms", perm: "forms.view" },
  { href: "/crm/campaigns", label: "Campaigns", perm: "campaigns.view" },
  { href: "/crm/automations", label: "Automations", perm: "automations.view" },
  { href: "/crm/reports", label: "Reports", perm: "reports.view" },
  { href: "/crm/assistant", label: "Assistant", perm: "assistant.view" },
  { href: "/crm/team", label: "Team", perm: "team.manage" },
  { href: "/crm/settings", label: "Settings", perm: "settings.view" },
];

/** First section this person may open (where to land after sign-in). */
export function homeFor(perms: readonly string[]): string {
  return SECTIONS.find((s) => perms.includes(s.perm))?.href ?? "/crm/account";
}

/** Safe in-app redirect target: only /crm paths, no protocol-relative tricks. */
export function safeNext(next: string | null | undefined, fallback = "/crm"): string {
  if (!next || !next.startsWith("/crm") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

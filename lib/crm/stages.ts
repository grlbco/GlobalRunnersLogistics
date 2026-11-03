export type Stage =
  | "new" | "contacted" | "replied" | "interested" | "form_sent" | "applied" | "qualified" | "sent_to_ken" | "hired"
  | "nurture" | "not_fit" | "not_interested" | "unsubscribed" | "bounced";

export type Tone = "cold" | "warm" | "hot" | "won" | "lost";

export const STAGES: { key: Stage; label: string; tone: Tone }[] = [
  { key: "new", label: "New", tone: "cold" },
  { key: "contacted", label: "Contacted", tone: "cold" },
  { key: "replied", label: "Replied", tone: "warm" },
  { key: "interested", label: "Interested", tone: "warm" },
  { key: "form_sent", label: "Form sent", tone: "warm" },
  { key: "applied", label: "Applied", tone: "hot" },
  { key: "qualified", label: "Qualified", tone: "hot" },
  { key: "sent_to_ken", label: "With Ken", tone: "hot" },
  { key: "hired", label: "Hired", tone: "won" },
  { key: "nurture", label: "Nurture", tone: "cold" },
  { key: "not_fit", label: "Not a fit", tone: "lost" },
  { key: "not_interested", label: "Not interested", tone: "lost" },
  { key: "unsubscribed", label: "Unsubscribed", tone: "lost" },
  { key: "bounced", label: "Bounced", tone: "lost" },
];

export const STAGE_KEYS = STAGES.map((s) => s.key);
export const stageLabel = (s: string) => STAGES.find((x) => x.key === s)?.label ?? s;
export const stageTone = (s: string): Tone => STAGES.find((x) => x.key === s)?.tone ?? "cold";

/** Pipeline board columns. Cold stages live in the Contacts table. */
export const BOARD: Stage[] = ["replied", "interested", "form_sent", "applied", "qualified", "sent_to_ken", "hired"];

/** Funnel shown on the dashboard, in order. */
export const FUNNEL: Stage[] = ["contacted", "replied", "interested", "form_sent", "applied", "hired"];

export const toneClass: Record<Tone, string> = {
  cold: "bg-white/[0.06] text-white/60",
  warm: "bg-dusk/15 text-dusk",
  hot: "bg-signal/15 text-[#ff7a57]",
  won: "bg-emerald-400/15 text-emerald-300",
  lost: "bg-white/[0.04] text-white/35",
};

export const TIERS: Record<number, string> = {
  1: "Inactive / OOS",
  2: "New authority",
  3: "Suspension pending",
  4: "Authority 3–18 mo",
  5: "Active solo",
};

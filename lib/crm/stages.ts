export type Stage =
  | "new" | "contacted" | "replied" | "interested" | "form_sent" | "chasing" | "applied" | "qualified" | "sent_to_ken" | "hired"
  | "nurture" | "not_fit" | "not_interested" | "unsubscribed" | "bounced";

export type Tone = "cold" | "warm" | "hot" | "won" | "lost";

export const STAGES: { key: Stage; label: string; tone: Tone }[] = [
  { key: "new", label: "New", tone: "cold" },
  { key: "contacted", label: "Contacted", tone: "cold" },
  { key: "replied", label: "Replied", tone: "warm" },
  { key: "interested", label: "Interested", tone: "warm" },
  { key: "form_sent", label: "Form started", tone: "warm" },
  { key: "chasing", label: "Following up", tone: "warm" },
  { key: "applied", label: "Form done", tone: "hot" },
  { key: "qualified", label: "Pre-screen passed", tone: "hot" },
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
export const BOARD: Stage[] = ["replied", "interested", "form_sent", "applied", "sent_to_ken", "hired"];

/** Off the board: paused or finished. Shown as counts that link to the contact list. */
export const OFF_BOARD: Stage[] = ["nurture", "not_interested", "not_fit", "unsubscribed", "bounced"];

/** Funnel shown on the dashboard, in order. */
export const FUNNEL: Stage[] = ["contacted", "replied", "interested", "form_sent", "applied", "hired"];

export const toneClass: Record<Tone, string> = {
  cold: "bg-hover text-muted",
  warm: "bg-warm-soft text-warm-ink",
  hot: "bg-signal-soft text-signal-ink",
  won: "bg-emerald-50 text-emerald-700",
  lost: "bg-hover text-faint",
};

export const toneDot: Record<Tone, string> = {
  cold: "bg-ghost",
  warm: "bg-dusk",
  hot: "bg-signal",
  won: "bg-emerald-500",
  lost: "bg-ghost",
};

export const TIERS: Record<number, string> = {
  1: "Inactive / OOS",
  2: "New authority",
  3: "Suspension pending",
  4: "Authority 3–18 mo",
  5: "Active solo",
};

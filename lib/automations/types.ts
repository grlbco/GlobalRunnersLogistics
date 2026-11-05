/** Workflow definitions shared by the engine (server) and the builder (client). */
export const TRIGGERS = {
  stage_changed: { label: "Stage changes", filter: "to" },
  text_received: { label: "Driver sends a text", filter: null },
  email_received: { label: "Driver replies by email", filter: null },
  contact_created: { label: "New contact (inbound)", filter: "source" },
  form_opened: { label: "Driver opens the form", filter: null },
  form_completed: { label: "Driver completes the driver application", filter: null },
  form_submitted: { label: "A form is submitted (Forms)", filter: "form" },
  email_opened: { label: "Driver opens an email", filter: null },
  link_clicked: { label: "Driver clicks a link", filter: null },
  tag_added: { label: "Tag added", filter: "tag" },
} as const;
export type TriggerType = keyof typeof TRIGGERS;

export type Condition = { field: "stage" | "sms_consent" | "form_completed" | "tag" | "replied_since_start" | "agent_mode" | "do_not_contact"; op: "eq" | "neq" | "is_true" | "is_false" | "has"; value?: string };

export type Step =
  | { type: "wait"; minutes?: number; hours?: number; days?: number }
  | ({ type: "if" } & Condition)
  | { type: "send_text"; body: string }
  | { type: "send_email"; subject?: string; body: string }
  | { type: "move_stage"; stage: string }
  | { type: "add_tag"; tag: string }
  | { type: "remove_tag"; tag: string }
  | { type: "create_task"; title: string; due_hours?: number }
  | { type: "notify"; to: "ken" | "team"; body: string }
  | { type: "hand_to_assistant" }
  | { type: "stop_assistant" };

export const STEP_LABELS: Record<Step["type"], string> = {
  wait: "Wait",
  if: "Only continue if",
  send_text: "Send text",
  send_email: "Send email (reply in thread)",
  move_stage: "Move stage",
  add_tag: "Add tag",
  remove_tag: "Remove tag",
  create_task: "Create task",
  notify: "Alert Ken / team",
  hand_to_assistant: "Let the assistant follow up",
  stop_assistant: "Stop the assistant (manual)",
};

export const CONDITION_FIELDS: Record<Condition["field"], string> = {
  stage: "Stage",
  sms_consent: "Text consent",
  form_completed: "Form completed",
  tag: "Has tag",
  replied_since_start: "Driver replied since this started",
  agent_mode: "Assistant mode",
  do_not_contact: "Do not contact",
};

export const TEMPLATE_VARS = ["{{first_name}}", "{{last_name}}", "{{company}}", "{{phone}}", "{{form_link}}", "{{ken_phone}}", "{{crm_link}}"];

/**
 * The vocabulary of the drag-and-drop builders.
 *
 * Every element a user can drop on a canvas is described here once, and the
 * palette, the node card, the inspector form and the tier-gating all read from
 * this single table. Adding a new element = adding one entry.
 */

export type NodeScope = "raket" | "module"
export type NodeCategory = "trigger" | "delay" | "action" | "logic" | "data"

export type FieldDef =
  | {
      key: string
      type: "text"
      label: string
      placeholder?: string
      help?: string
    }
  | {
      key: string
      type: "textarea"
      label: string
      placeholder?: string
      rows?: number
      help?: string
    }
  | {
      key: string
      type: "number"
      label: string
      min?: number
      max?: number
      suffix?: string
      help?: string
    }
  | {
      key: string
      type: "select"
      label: string
      options: ReadonlyArray<{ value: string; label: string }>
      help?: string
    }

export interface NodeTypeDef {
  /** Matches flow_nodes.type in the database. */
  type: string
  label: string
  /** Short palette label — keep to ~12 chars so it fits a phone. */
  short: string
  description: string
  /** lucide-react icon name. */
  icon: string
  category: NodeCategory
  /** chart-1..chart-5 — drives the node's accent colour. */
  accent: string
  scope: NodeScope
  /** Which marketplace module provides this element. Undefined = core. */
  moduleId?: string
  fields: readonly FieldDef[]
  defaults: Record<string, unknown>
  /** Cap instances per canvas (a flow may only have one trigger). */
  maxPerFlow?: number
  /** One-line description rendered on the node card. */
  summary: (data: Record<string, unknown>) => string
}

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback

const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback

// -----------------------------------------------------------------------------
// Outer canvas — "Build your Raket"
// -----------------------------------------------------------------------------
const START: NodeTypeDef = {
  type: "start",
  label: "Your business",
  short: "Business",
  description: "Where every raket begins. Connect modules to this.",
  icon: "Rocket",
  category: "trigger",
  accent: "chart-1",
  scope: "raket",
  maxPerFlow: 1,
  fields: [
    {
      key: "label",
      type: "text",
      label: "Business name",
      placeholder: "Aling Nena's Bakeshop",
    },
  ],
  defaults: { label: "Your business" },
  summary: () => "The root of your raket",
}

const MODULE: NodeTypeDef = {
  type: "module",
  label: "Module",
  short: "Module",
  description: "A feature you activated from the marketplace. Tap to open it.",
  icon: "Boxes",
  category: "action",
  accent: "chart-1",
  scope: "raket",
  fields: [
    { key: "label", type: "text", label: "Name on canvas" },
    {
      key: "note",
      type: "textarea",
      label: "Note to self",
      rows: 2,
      placeholder: "What is this module for?",
    },
  ],
  defaults: { label: "Module" },
  summary: (d) => str(d.note, "Tap to open the builder"),
}

// -----------------------------------------------------------------------------
// Booking module — inner canvas
// -----------------------------------------------------------------------------
const BOOKING: NodeTypeDef = {
  type: "booking",
  label: "New booking",
  short: "Booking",
  description: "Starts the flow when someone books a slot with you.",
  icon: "CalendarCheck",
  category: "trigger",
  accent: "chart-1",
  scope: "module",
  moduleId: "booking",
  maxPerFlow: 1,
  fields: [
    { key: "label", type: "text", label: "Step name" },
    {
      key: "service",
      type: "text",
      label: "Service offered",
      placeholder: "Haircut, Consultation, Delivery slot…",
    },
    {
      key: "durationMinutes",
      type: "number",
      label: "Slot length",
      min: 5,
      max: 480,
      suffix: "min",
    },
    {
      key: "requireContact",
      type: "select",
      label: "Ask customer for",
      options: [
        { value: "email", label: "Email only" },
        { value: "phone", label: "Mobile number only" },
        { value: "both", label: "Email and mobile" },
      ],
    },
  ],
  defaults: {
    label: "New booking",
    service: "Consultation",
    durationMinutes: 30,
    requireContact: "email",
  },
  summary: (d) =>
    `${str(d.service, "Any service")} · ${num(d.durationMinutes, 30)} min`,
}

const TIMER: NodeTypeDef = {
  type: "timer",
  label: "Wait",
  short: "Timer",
  description: "Pause before the next step runs.",
  icon: "Timer",
  category: "delay",
  accent: "chart-2",
  scope: "module",
  moduleId: "booking",
  fields: [
    { key: "label", type: "text", label: "Step name" },
    { key: "delayValue", type: "number", label: "Wait for", min: 1, max: 999 },
    {
      key: "delayUnit",
      type: "select",
      label: "Unit",
      options: [
        { value: "minutes", label: "Minutes" },
        { value: "hours", label: "Hours" },
        { value: "days", label: "Days" },
      ],
    },
    {
      key: "relativeTo",
      type: "select",
      label: "Counted from",
      options: [
        { value: "booking", label: "When the booking was made" },
        { value: "appointment", label: "Before the appointment" },
      ],
    },
  ],
  defaults: {
    label: "Wait",
    delayValue: 1,
    delayUnit: "hours",
    relativeTo: "booking",
  },
  summary: (d) => {
    const value = num(d.delayValue, 1)
    const unit = str(d.delayUnit, "hours")
    const singular = value === 1 ? unit.replace(/s$/, "") : unit
    const from =
      str(d.relativeTo, "booking") === "appointment"
        ? "before appointment"
        : "after booking"
    return `Wait ${value} ${singular} ${from}`
  },
}

const EMAIL: NodeTypeDef = {
  type: "email",
  label: "Send email",
  short: "Email",
  description: "Email the customer automatically.",
  icon: "Mail",
  category: "action",
  accent: "chart-3",
  scope: "module",
  moduleId: "booking",
  fields: [
    { key: "label", type: "text", label: "Step name" },
    {
      key: "subject",
      type: "text",
      label: "Subject",
      placeholder: "Your booking is confirmed",
    },
    {
      key: "body",
      type: "textarea",
      label: "Message",
      rows: 5,
      help: "Use {{name}}, {{service}} and {{time}} to personalise.",
    },
    {
      key: "sendTo",
      type: "select",
      label: "Send to",
      options: [
        { value: "customer", label: "The customer" },
        { value: "me", label: "Me (the owner)" },
        { value: "both", label: "Both" },
      ],
    },
  ],
  defaults: {
    label: "Send confirmation",
    subject: "Your booking is confirmed",
    body: "Salamat, {{name}}! We've reserved your {{service}} slot on {{time}}. See you soon.",
    sendTo: "customer",
  },
  summary: (d) => str(d.subject, "No subject yet"),
}

// -----------------------------------------------------------------------------
// Locked elements — shown in the palette as upsells for higher module tiers.
// -----------------------------------------------------------------------------
const SMS: NodeTypeDef = {
  type: "sms",
  label: "Send SMS",
  short: "SMS",
  description: "Text the customer a reminder.",
  icon: "MessageSquare",
  category: "action",
  accent: "chart-3",
  scope: "module",
  moduleId: "booking",
  fields: [
    { key: "label", type: "text", label: "Step name" },
    { key: "message", type: "textarea", label: "Message", rows: 3 },
  ],
  defaults: { label: "Send SMS", message: "Reminder: your booking is tomorrow." },
  summary: (d) => str(d.message, "No message yet"),
}

const CONDITION: NodeTypeDef = {
  type: "condition",
  label: "If / then",
  short: "Branch",
  description: "Split the flow based on an answer.",
  icon: "GitBranch",
  category: "logic",
  accent: "chart-4",
  scope: "module",
  moduleId: "booking",
  fields: [
    { key: "label", type: "text", label: "Step name" },
    {
      key: "check",
      type: "select",
      label: "Check",
      options: [
        { value: "confirmed", label: "Did the customer confirm?" },
        { value: "paid", label: "Has the deposit been paid?" },
        { value: "showed", label: "Did they show up?" },
      ],
    },
  ],
  defaults: { label: "If / then", check: "confirmed" },
  summary: (d) => `Check: ${str(d.check, "confirmed")}`,
}

const CALENDAR: NodeTypeDef = {
  type: "calendar",
  label: "Add to calendar",
  short: "Calendar",
  description: "Push the booking to your Google Calendar.",
  icon: "CalendarPlus",
  category: "action",
  accent: "chart-5",
  scope: "module",
  moduleId: "booking",
  fields: [{ key: "label", type: "text", label: "Step name" }],
  defaults: { label: "Add to calendar" },
  summary: () => "Sync to Google Calendar",
}

const PAYMENT: NodeTypeDef = {
  type: "payment",
  label: "Collect payment",
  short: "Payment",
  description: "Ask for a deposit via GCash, Maya or card.",
  icon: "CreditCard",
  category: "action",
  accent: "chart-2",
  scope: "module",
  moduleId: "booking",
  fields: [
    { key: "label", type: "text", label: "Step name" },
    {
      key: "amountPesos",
      type: "number",
      label: "Amount",
      min: 1,
      suffix: "PHP",
    },
    {
      key: "mode",
      type: "select",
      label: "Type",
      options: [
        { value: "deposit", label: "Deposit only" },
        { value: "full", label: "Full payment" },
      ],
    },
  ],
  defaults: { label: "Collect payment", amountPesos: 200, mode: "deposit" },
  summary: (d) => `${str(d.mode, "deposit")} · PHP ${num(d.amountPesos, 0)}`,
}

const ASSIGN: NodeTypeDef = {
  type: "assign",
  label: "Assign to staff",
  short: "Assign",
  description: "Route the booking to a team member.",
  icon: "UserCheck",
  category: "logic",
  accent: "chart-4",
  scope: "module",
  moduleId: "booking",
  fields: [
    { key: "label", type: "text", label: "Step name" },
    { key: "staff", type: "text", label: "Staff name" },
  ],
  defaults: { label: "Assign to staff", staff: "" },
  summary: (d) => str(d.staff, "Nobody assigned yet"),
}

const WEBHOOK: NodeTypeDef = {
  type: "webhook",
  label: "Call a webhook",
  short: "Webhook",
  description: "Ping another system when this step runs.",
  icon: "Webhook",
  category: "data",
  accent: "chart-5",
  scope: "module",
  moduleId: "booking",
  fields: [
    { key: "label", type: "text", label: "Step name" },
    { key: "url", type: "text", label: "URL", placeholder: "https://…" },
  ],
  defaults: { label: "Call a webhook", url: "" },
  summary: (d) => str(d.url, "No URL yet"),
}

// -----------------------------------------------------------------------------

export const NODE_TYPES: readonly NodeTypeDef[] = [
  START,
  MODULE,
  BOOKING,
  TIMER,
  EMAIL,
  SMS,
  CONDITION,
  CALENDAR,
  PAYMENT,
  ASSIGN,
  WEBHOOK,
]

const BY_TYPE = new Map(NODE_TYPES.map((n) => [n.type, n]))

export function getNodeType(type: string): NodeTypeDef | undefined {
  return BY_TYPE.get(type)
}

/** Falls back to a neutral descriptor so an unknown type never crashes a canvas. */
export function resolveNodeType(type: string): NodeTypeDef {
  return (
    BY_TYPE.get(type) ?? {
      ...MODULE,
      type,
      label: type,
      short: type,
      description: "Unrecognised element.",
    }
  )
}

/** Elements that belong on a given canvas, optionally filtered to one module. */
export function nodeTypesForScope(
  scope: NodeScope,
  moduleId?: string
): NodeTypeDef[] {
  return NODE_TYPES.filter((n) => {
    if (n.scope !== scope) return false
    if (scope === "module" && moduleId) return n.moduleId === moduleId
    return true
  })
}

/** Apply a node type's defaults under any values already stored. */
export function withDefaults(
  type: string,
  data: Record<string, unknown> = {}
): Record<string, unknown> {
  const def = resolveNodeType(type)
  return { ...def.defaults, ...data }
}

/** Safe summary — a throwing summary fn must never take the canvas down. */
export function summarise(
  type: string,
  data: Record<string, unknown> = {}
): string {
  const def = resolveNodeType(type)
  try {
    return def.summary(withDefaults(type, data))
  } catch {
    return def.description
  }
}

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  trigger: "Trigger",
  delay: "Wait",
  action: "Action",
  logic: "Logic",
  data: "Data",
}

/**
 * The question types a booking form can ask.
 *
 * One table drives the builder's type picker, the public form's renderer and
 * answer validation — adding a type is one entry, as with the flow registry.
 */

import type { BookingFieldType, BookingFormFieldRow } from "@/lib/supabase/types"

export interface FieldTypeDef {
  type: BookingFieldType
  label: string
  description: string
  /** lucide-react icon name. */
  icon: string
  /** Does the builder need to collect a list of choices? */
  hasOptions: boolean
  /** Does this render as a plain single-line input? */
  singleLine: boolean
}

export const FIELD_TYPES: readonly FieldTypeDef[] = [
  {
    type: "short_text",
    label: "Short answer",
    description: "One line — a name, a reference, a nickname.",
    icon: "Type",
    hasOptions: false,
    singleLine: true,
  },
  {
    type: "long_text",
    label: "Paragraph",
    description: "Room to explain — notes, requests, directions.",
    icon: "AlignLeft",
    hasOptions: false,
    singleLine: false,
  },
  {
    type: "email",
    label: "Email",
    description: "Checked for an @ before it is accepted.",
    icon: "Mail",
    hasOptions: false,
    singleLine: true,
  },
  {
    type: "phone",
    label: "Mobile number",
    description: "Opens the number pad on a phone.",
    icon: "Phone",
    hasOptions: false,
    singleLine: true,
  },
  {
    type: "number",
    label: "Number",
    description: "How many, how much, what size.",
    icon: "Hash",
    hasOptions: false,
    singleLine: true,
  },
  {
    type: "select",
    label: "Multiple choice",
    description: "Pick one from a list you write.",
    icon: "CircleDot",
    hasOptions: true,
    singleLine: false,
  },
  {
    type: "multi_select",
    label: "Checkboxes",
    description: "Pick as many as apply.",
    icon: "ListChecks",
    hasOptions: true,
    singleLine: false,
  },
  {
    type: "checkbox",
    label: "Yes / no",
    description: "A single tick — consent, confirmation.",
    icon: "SquareCheck",
    hasOptions: false,
    singleLine: false,
  },
  {
    type: "date",
    label: "Date",
    description: "A date that is not the booking itself.",
    icon: "CalendarDays",
    hasOptions: false,
    singleLine: true,
  },
  {
    type: "upload",
    label: "File upload",
    description: "A photo or PDF, up to 10MB.",
    icon: "Paperclip",
    hasOptions: false,
    singleLine: false,
  },
]

const BY_TYPE = new Map(FIELD_TYPES.map((f) => [f.type, f]))

export function getFieldType(type: string): FieldTypeDef | undefined {
  return BY_TYPE.get(type as BookingFieldType)
}

/** Never lets an unrecognised type crash a form. */
export function resolveFieldType(type: string): FieldTypeDef {
  return BY_TYPE.get(type as BookingFieldType) ?? FIELD_TYPES[0]
}

export function fieldTypeLabel(type: string): string {
  return resolveFieldType(type).label
}

export type AnswerValue = string | string[] | boolean | number | null

/**
 * Validates one answer. Returns an error message, or null when it is fine.
 * Shared by the public form's client-side hints and the server action that
 * actually stores the booking — the server must never trust the client's pass.
 */
export function validateAnswer(
  field: Pick<BookingFormFieldRow, "label" | "type" | "required" | "options">,
  value: AnswerValue
): string | null {
  const empty =
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (field.type === "checkbox" && value === false)

  if (field.required && empty) return `${field.label} is required.`
  if (empty) return null

  switch (field.type) {
    case "email": {
      const text = String(value).trim()
      // Deliberately loose: the only reliable test of an address is delivery.
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
        ? null
        : `${field.label} does not look like an email address.`
    }
    case "phone": {
      const digits = String(value).replace(/\D/g, "")
      return digits.length >= 7 && digits.length <= 15
        ? null
        : `${field.label} does not look like a mobile number.`
    }
    case "number":
      return Number.isFinite(Number(value))
        ? null
        : `${field.label} must be a number.`
    case "select": {
      const options = field.options ?? []
      return options.length === 0 || options.includes(String(value))
        ? null
        : `Pick one of the listed options for ${field.label}.`
    }
    case "multi_select": {
      const options = field.options ?? []
      const chosen = Array.isArray(value) ? value : [String(value)]
      return options.length === 0 || chosen.every((c) => options.includes(c))
        ? null
        : `Pick from the listed options for ${field.label}.`
    }
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(String(value))
        ? null
        : `${field.label} must be a date.`
    default:
      return null
  }
}

/** Validates a whole submission; returns one message per failing field id. */
export function validateAnswers(
  fields: Pick<
    BookingFormFieldRow,
    "id" | "label" | "type" | "required" | "options"
  >[],
  answers: Record<string, AnswerValue>
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    const message = validateAnswer(field, answers[field.id] ?? null)
    if (message) errors[field.id] = message
  }
  return errors
}

/**
 * An answer as one readable line.
 *
 * Deliberately never throws on a surprise shape: answers are stored as jsonb
 * and a row written by an older version of the form must still render.
 */
export function answerToText(value: AnswerValue | undefined): string {
  if (value === null || value === undefined) return ""
  if (Array.isArray(value)) return value.join(", ")
  if (typeof value === "boolean") return value ? "Yes" : ""
  return String(value)
}

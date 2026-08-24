"use client"

import type * as React from "react"
import { CloudUpload } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { AnswerValue } from "@/lib/booking/fields"
import type { BookingFormFieldRow } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

/** What the upload box promises to take, named once and shown to the client. */
export const UPLOAD_ACCEPT = "image/*,application/pdf"
export const UPLOAD_MAX_MB = 10

export interface FieldPreviewProps {
  field: BookingFormFieldRow
  value?: AnswerValue
  /** Leave this out and the field renders as an inert preview. */
  onChange?: (value: AnswerValue) => void
  disabled?: boolean
  error?: string
}

/* ------------------------------------------------------------------ *
 * Answers arrive as `AnswerValue`, which is deliberately wide — these
 * narrow it per control without ever throwing on a surprise shape.
 * ------------------------------------------------------------------ */

export function answerToText(value: AnswerValue | undefined): string {
  if (value === null || value === undefined) return ""
  if (Array.isArray(value)) return value.join(", ")
  if (typeof value === "boolean") return value ? "Yes" : ""
  return String(value)
}

export function answerToList(value: AnswerValue | undefined): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string")
  if (typeof value === "string" && value !== "") return [value]
  return []
}

export function answerToBool(value: AnswerValue | undefined): boolean {
  if (typeof value === "boolean") return value
  return value === "true" || value === "on" || value === 1
}

/**
 * The keyboard a phone raises is decided entirely by these two attributes,
 * so they live in a static map instead of being pieced together inline.
 */
const INPUT_ATTRS: Record<
  string,
  {
    type: string
    inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
    autoComplete?: string
  }
> = {
  short_text: { type: "text" },
  email: { type: "email", inputMode: "email", autoComplete: "email" },
  phone: { type: "tel", inputMode: "tel", autoComplete: "tel" },
  number: { type: "number", inputMode: "decimal" },
  date: { type: "date" },
}

/** One tappable choice — the whole row is the target, not the little circle. */
const CHOICE_ROW =
  "flex min-h-11 items-center gap-3 rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/8 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50 dark:bg-input/30"

/**
 * Renders one booking question, inert or live.
 *
 * The builder preview and the public form both come through here, which is
 * the whole point: what the owner sees while writing a question is the same
 * markup their suki taps on later.
 */
export function FieldPreview({
  field,
  value,
  onChange,
  disabled,
  error,
}: FieldPreviewProps) {
  // No `onChange` means nobody is listening — still render it, but keep it out
  // of the tab order and out of reach so a preview cannot be typed into.
  const inert = typeof onChange !== "function"
  const emit = (next: AnswerValue) => onChange?.(next)

  const helpId = `${field.id}-help`
  const errorId = `${field.id}-error`
  const labelId = `${field.id}-label`
  const describedBy =
    [field.help ? helpId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined

  const required = field.required
  const invalid = error ? true : undefined
  const options = field.options ?? []
  const grouped = field.type === "select" || field.type === "multi_select"

  // A yes/no question carries its own wording beside the tick, so its hint has
  // to follow the control rather than float above it with nothing to explain.
  const helpAfterControl = field.type === "checkbox"
  const helpNode = field.help ? (
    <p id={helpId} className="text-xs text-pretty text-muted-foreground">
      {field.help}
    </p>
  ) : null

  const requiredMark = required ? (
    <span className="font-normal text-destructive" title="Required">
      *<span className="sr-only"> Required</span>
    </span>
  ) : null

  const shared = {
    disabled,
    tabIndex: inert ? -1 : undefined,
    "aria-describedby": describedBy,
    "aria-invalid": invalid,
  }

  let control: React.ReactNode = null
  const attrs = INPUT_ATTRS[field.type]

  if (attrs) {
    control = (
      <Input
        {...shared}
        id={field.id}
        type={attrs.type}
        inputMode={attrs.inputMode}
        autoComplete={attrs.autoComplete}
        readOnly={inert}
        required={required}
        placeholder={field.placeholder ?? undefined}
        value={answerToText(value)}
        onChange={(event) => emit(event.target.value)}
        className="h-11"
      />
    )
  } else if (field.type === "long_text") {
    control = (
      <Textarea
        {...shared}
        id={field.id}
        rows={4}
        readOnly={inert}
        required={required}
        placeholder={field.placeholder ?? undefined}
        value={answerToText(value)}
        onChange={(event) => emit(event.target.value)}
        className="min-h-24"
      />
    )
  } else if (field.type === "select") {
    const picked = answerToText(value)
    control = options.length ? (
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-required={required ? true : undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        className="grid gap-2"
      >
        {options.map((option, index) => (
          // Keyed by position as well as text: a row saved before the builder
          // started de-duplicating could still hold the same choice twice.
          <label
            key={`${index}-${option}`}
            className={cn(CHOICE_ROW, disabled && "opacity-50")}
          >
            <input
              type="radio"
              name={field.id}
              value={option}
              checked={picked === option}
              disabled={disabled}
              tabIndex={inert ? -1 : undefined}
              onChange={() => emit(option)}
              className="size-4 shrink-0 accent-primary"
            />
            <span className="min-w-0 flex-1 text-pretty">{option}</span>
          </label>
        ))}
      </div>
    ) : (
      <EmptyChoices />
    )
  } else if (field.type === "multi_select") {
    const picked = answerToList(value)
    control = options.length ? (
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        className="grid gap-2"
      >
        {options.map((option, index) => (
          <label
            key={`${index}-${option}`}
            className={cn(CHOICE_ROW, disabled && "opacity-50")}
          >
            <input
              type="checkbox"
              name={field.id}
              value={option}
              checked={picked.includes(option)}
              disabled={disabled}
              // The wrapping role="group" supports neither aria-invalid nor
              // aria-required, so the invalid state rides on the controls.
              aria-invalid={invalid}
              tabIndex={inert ? -1 : undefined}
              onChange={(event) =>
                emit(
                  event.target.checked
                    ? [...picked, option]
                    : picked.filter((v) => v !== option)
                )
              }
              className="size-4 shrink-0 rounded accent-primary"
            />
            <span className="min-w-0 flex-1 text-pretty">{option}</span>
          </label>
        ))}
      </div>
    ) : (
      <EmptyChoices />
    )
  } else if (field.type === "checkbox") {
    control = (
      <label className={cn(CHOICE_ROW, disabled && "opacity-50")}>
        <input
          type="checkbox"
          id={field.id}
          checked={answerToBool(value)}
          disabled={disabled}
          required={required}
          tabIndex={inert ? -1 : undefined}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          onChange={(event) => emit(event.target.checked)}
          className="size-4 shrink-0 rounded accent-primary"
        />
        <span id={labelId} className="min-w-0 flex-1 text-pretty">
          {field.label}
          {requiredMark}
        </span>
      </label>
    )
  } else if (field.type === "upload") {
    // Only the file name travels back through `onChange` — moving the bytes is
    // the booking page's job, not this component's.
    const filename = answerToText(value)
    control = (
      <label
        className={cn(
          "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-input bg-muted/40 px-4 py-5 text-center transition-colors hover:border-ring has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <CloudUpload className="size-5 text-muted-foreground" />
        <span className="text-sm font-medium text-pretty">
          {filename || "Tap to attach a file"}
        </span>
        <span className="text-xs text-muted-foreground">
          Photo or PDF, up to {UPLOAD_MAX_MB}MB
        </span>
        <input
          id={field.id}
          type="file"
          accept={UPLOAD_ACCEPT}
          disabled={disabled}
          required={required}
          tabIndex={inert ? -1 : undefined}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          onChange={(event) => emit(event.target.files?.[0]?.name ?? null)}
          className="sr-only"
        />
      </label>
    )
  } else {
    // An unrecognised type still has to render something answerable.
    control = (
      <Input
        {...shared}
        id={field.id}
        readOnly={inert}
        placeholder={field.placeholder ?? undefined}
        value={answerToText(value)}
        onChange={(event) => emit(event.target.value)}
        className="h-11"
      />
    )
  }

  return (
    <div
      data-slot="field-preview"
      data-type={field.type}
      className={cn("space-y-2", inert && "pointer-events-none select-none")}
    >
      {field.type === "checkbox" ? null : (
        // A group of radios has no single control to point `for` at; the group
        // is wired to this label by `aria-labelledby` instead.
        <Label
          id={labelId}
          htmlFor={grouped ? undefined : field.id}
          className="gap-1 text-sm text-pretty"
        >
          {field.label}
          {requiredMark}
        </Label>
      )}

      {helpAfterControl ? null : helpNode}

      {control}

      {helpAfterControl ? helpNode : null}

      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function EmptyChoices() {
  return (
    <p className="rounded-lg border border-dashed border-input px-3 py-3 text-sm text-muted-foreground">
      No choices yet.
    </p>
  )
}

"use client"

import { createElement, useEffect, useId, useMemo, useRef, useState, useTransition } from "react"
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronRight,
  CircleDot,
  Eye,
  Hash,
  ListChecks,
  Lock,
  Mail,
  Paperclip,
  Phone,
  Plus,
  Sparkles,
  SquareCheck,
  Trash2,
  Type,
  X,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  FIELD_TYPES,
  resolveFieldType,
  type AnswerValue,
} from "@/lib/booking/fields"
import type {
  BookingFieldType,
  BookingFormFieldRow,
} from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

import {
  deleteField,
  reorderFields,
  saveField,
} from "@/features/booking/actions"
import { FieldPreview } from "@/features/booking/field-preview"
import {
  sheetSideClass,
  useIsDesktop,
  type SheetSide,
} from "@/features/builder/use-is-desktop"

/* ------------------------------------------------------------------ *
 * Limits, mirrored from the zod schema in actions.ts so the person
 * typing hears about a problem before a round trip does.
 * ------------------------------------------------------------------ */

export const LABEL_MAX = 120
export const HELP_MAX = 200
export const PLACEHOLDER_MAX = 120
export const CHOICES_MAX = 50
export const CHOICES_MIN = 2

const SOMETHING_WRONG = "Something went wrong. Please try again."
const COULD_NOT_SAVE = "We could not save that question."

/**
 * The icon for each question type, keyed by the name the registry in
 * `lib/booking/fields.ts` gives it.
 *
 * The shared module icon map only knows the names the seed data uses — nine of
 * these ten would fall through to its generic box and every question type
 * would look identical. Static map, real imports: nothing is built from a
 * string at runtime, so the bundler keeps every icon that is actually used.
 */
const FIELD_ICONS: Record<string, LucideIcon> = {
  Type,
  AlignLeft,
  Mail,
  Phone,
  Hash,
  CircleDot,
  ListChecks,
  SquareCheck,
  CalendarDays,
  Paperclip,
}

/**
 * Rendered through `createElement` rather than `const Icon = …; <Icon />`,
 * which reads to the linter as building a component on every render.
 */
function FieldIcon({ name, className }: { name: string; className?: string }) {
  return createElement(FIELD_ICONS[name] ?? Type, { className })
}

/** The editor's working copy of a question — all strings, never null. */
export interface FieldDraft {
  label: string
  type: BookingFieldType
  help: string
  placeholder: string
  required: boolean
  options: string[]
}

/** One tap each, for a form that is still empty. */
export const STARTER_FIELDS: readonly FieldDraft[] = [
  {
    label: "Mobile number",
    type: "phone",
    help: "So you can text them if something moves.",
    placeholder: "09XX XXX XXXX",
    required: true,
    options: [],
  },
  {
    label: "What service?",
    type: "select",
    help: "",
    placeholder: "",
    required: true,
    options: ["Consultation", "Full service", "Follow-up"],
  },
  {
    label: "Any notes?",
    type: "long_text",
    help: "Anything you should know before they arrive.",
    // A paragraph box keeps no placeholder — see `draftPayload`.
    placeholder: "",
    required: false,
    options: [],
  },
]

/* ------------------------------------------------------------------ *
 * Pure helpers — the moving parts worth testing on their own.
 * ------------------------------------------------------------------ */

/** Trims, drops the blanks, and keeps the first of any repeat. */
export function cleanChoices(options: readonly string[]): string[] {
  const seen = new Set<string>()
  const kept: string[] = []
  for (const option of options) {
    const trimmed = option.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    kept.push(trimmed)
  }
  return kept
}

/**
 * Moves one item by a single step.
 *
 * Reordering is done with buttons rather than dragging because a thumb on a
 * phone cannot drag reliably, so this is the only path that has to be right:
 * at either end it hands back the list unchanged.
 */
export function moveField<T>(
  items: readonly T[],
  index: number,
  direction: -1 | 1
): T[] {
  const next = [...items]
  if (index < 0 || index >= next.length) return next

  const target = index + direction
  if (target < 0 || target >= next.length) return next

  const moved = next[index]
  next[index] = next[target]
  next[target] = moved
  return next
}

/** Returns the reason a draft cannot be saved, or null when it is fine. */
export function validateFieldDraft(draft: FieldDraft): string | null {
  const label = draft.label.trim()
  if (!label) return "Every question needs a label."
  if (label.length > LABEL_MAX) {
    return `Keep the question under ${LABEL_MAX} characters.`
  }
  if (draft.help.trim().length > HELP_MAX) {
    return `Keep the hint under ${HELP_MAX} characters.`
  }
  if (draft.placeholder.trim().length > PLACEHOLDER_MAX) {
    return `Keep the placeholder under ${PLACEHOLDER_MAX} characters.`
  }

  if (resolveFieldType(draft.type).hasOptions) {
    const choices = cleanChoices(draft.options)
    if (choices.length < CHOICES_MIN) {
      return "A choice question needs at least two choices."
    }
    if (choices.length > CHOICES_MAX) {
      return "That is a very long list of choices."
    }
  }
  return null
}

/** A saved row, or a blank slate, opened up for editing. */
export function draftFromField(field: BookingFormFieldRow | null): FieldDraft {
  if (!field) {
    return {
      label: "",
      type: "short_text",
      help: "",
      placeholder: "",
      required: false,
      options: [],
    }
  }
  return {
    label: field.label,
    type: field.type,
    help: field.help ?? "",
    placeholder: field.placeholder ?? "",
    required: field.required,
    options: field.options?.length ? [...field.options] : [],
  }
}

/** The half of `SaveFieldInput` that comes from the draft. */
function draftPayload(draft: FieldDraft) {
  const def = resolveFieldType(draft.type)
  return {
    label: draft.label.trim(),
    type: draft.type,
    help: draft.help.trim(),
    // `saveField` only keeps a placeholder on a single-line box. Sending one
    // for a paragraph would look saved and come back empty on the next load.
    placeholder: def.singleLine ? draft.placeholder.trim() : "",
    required: draft.required,
    options: def.hasOptions ? cleanChoices(draft.options) : [],
  }
}

/** The one-line hint of the choices, shown on a collapsed card. */
function summariseChoices(options: string[]): string | null {
  if (options.length === 0) return null
  const head = options.slice(0, 3).join(" · ")
  const rest = options.length - 3
  return rest > 0 ? `${head} +${rest} more` : head
}

/* ------------------------------------------------------------------ *
 * The builder
 * ------------------------------------------------------------------ */

export interface FormBuilderProps {
  calendarId: string
  fields: BookingFormFieldRow[]
}

export function FormBuilder({ calendarId, fields }: FormBuilderProps) {
  // Optimism is kept as an order and a tombstone list rather than a copy of
  // the rows, so a refresh from the server always wins on content and these
  // only decide what sits where.
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null)
  const [removedIds, setRemovedIds] = useState<string[]>([])

  const [editing, setEditing] = useState<{
    field: BookingFormFieldRow | null
  } | null>(null)
  const [deleting, setDeleting] = useState<BookingFormFieldRow | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [starterLabel, setStarterLabel] = useState<string | null>(null)
  // A one-shot, so a ref rather than state: storing it would mean clearing it
  // from an effect, which is a second render for something nothing renders.
  const pendingFocus = useRef<string | null>(null)

  const [reordering, startReorder] = useTransition()
  const [removing, startRemoving] = useTransition()
  const [addingStarter, startStarter] = useTransition()

  const isDesktop = useIsDesktop()
  const side: SheetSide = isDesktop ? "right" : "bottom"

  const items = useMemo(() => {
    const visible = fields.filter((field) => !removedIds.includes(field.id))
    if (!pendingOrder) return visible

    const byId = new Map(visible.map((field) => [field.id, field]))
    const sorted: BookingFormFieldRow[] = []
    for (const id of pendingOrder) {
      const found = byId.get(id)
      if (found) {
        sorted.push(found)
        byId.delete(id)
      }
    }
    // A question added since this order was captured keeps its own place.
    return [...sorted, ...byId.values()]
  }, [fields, pendingOrder, removedIds])

  /**
   * After a move the button the person just pressed has travelled with the
   * card, so focus has to be put back on it by hand or the keyboard lands on
   * the body. Looked up by id: `Button` is a Base UI primitive and this stays
   * clear of how it does or does not forward a ref.
   */
  useEffect(() => {
    const focusKey = pendingFocus.current
    if (!focusKey) return
    pendingFocus.current = null
    if (typeof document === "undefined") return

    const [id, direction] = focusKey.split("|")
    const primary = document.getElementById(`move-${direction}-${id}`)
    const target =
      primary instanceof HTMLButtonElement && !primary.disabled
        ? primary
        : document.getElementById(
            `move-${direction === "up" ? "down" : "up"}-${id}`
          )
    if (target instanceof HTMLElement) target.focus()
  }, [pendingOrder])

  // Reordering is deliberately left out: every call sends the whole order, so
  // the last one wins and a person can tap up-up-up without waiting. Disabling
  // the button mid-tap would also throw focus off it.
  const busy = removing || addingStarter

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= items.length) return

    const moved = items[index]
    const before = pendingOrder
    const next = moveField(items, index, direction)
    const orderedIds = next.map((field) => field.id)

    setPendingOrder(orderedIds)
    pendingFocus.current = `${moved.id}|${direction === -1 ? "up" : "down"}`

    startReorder(async () => {
      try {
        const result = await reorderFields({ calendarId, orderedIds })
        if (!result.ok) {
          setPendingOrder(before)
          toast.error(result.message ?? "We could not save the new order.")
        }
      } catch {
        setPendingOrder(before)
        toast.error(SOMETHING_WRONG)
      }
    })
  }

  function confirmDelete() {
    const target = deleting
    if (!target) return

    startRemoving(async () => {
      try {
        const result = await deleteField(target.id)
        if (!result.ok) {
          toast.error(result.message ?? "We could not remove that question.")
          return
        }
        setRemovedIds((current) => [...current, target.id])
        setDeleting(null)
        toast.success("Question removed.")
      } catch {
        toast.error(SOMETHING_WRONG)
      }
    })
  }

  function addStarter(starter: FieldDraft) {
    setStarterLabel(starter.label)
    startStarter(async () => {
      try {
        const result = await saveField({
          calendarId,
          ...draftPayload(starter),
        })
        if (!result.ok) {
          toast.error(result.message ?? "We could not add that question.")
          return
        }
        toast.success(`Added “${starter.label}”. Salamat!`)
      } catch {
        toast.error(SOMETHING_WRONG)
      } finally {
        setStarterLabel(null)
      }
    })
  }

  return (
    <section className="space-y-4 lg:space-y-6" data-slot="form-builder">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight lg:text-base">
            Questions at booking
          </h3>
          <p className="mt-0.5 text-xs text-pretty text-muted-foreground lg:text-sm">
            {items.length === 0
              ? "Just the basics for now."
              : `${items.length} extra ${
                  items.length === 1 ? "question" : "questions"
                } after the basics.`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            className="h-11 lg:hidden"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye />
            Preview
          </Button>
          <Button
            className="h-11 lg:h-9"
            onClick={() => setEditing({ field: null })}
          >
            <Plus />
            Add question
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start lg:gap-8">
        <div className="min-w-0 lg:col-span-2">
          {items.length === 0 ? (
            <EmptyState
              busyLabel={addingStarter ? starterLabel : null}
              disabled={busy}
              onAdd={() => setEditing({ field: null })}
              onStarter={addStarter}
            />
          ) : (
            <ol
              aria-label="Booking questions"
              aria-busy={reordering || undefined}
              className="space-y-2.5 lg:space-y-3"
            >
              {items.map((field, index) => (
                <QuestionCard
                  key={field.id}
                  field={field}
                  index={index}
                  total={items.length}
                  busy={busy}
                  onEdit={() => setEditing({ field })}
                  onDelete={() => setDeleting(field)}
                  onMove={(direction) => move(index, direction)}
                />
              ))}
            </ol>
          )}
        </div>

        {/* From `lg` the extra width earns a permanent, live copy of the form
            beside the list; below it, the same thing lives behind Preview.

            Only ever one of the two is mounted. A preview renders the real
            controls, ids and all, so a second hidden copy would put duplicate
            ids on the page and send every `for` to the invisible one. */}
        <aside className="hidden min-w-0 lg:block">
          {isDesktop ? (
            <div className="lg:sticky lg:top-8">
              <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <Eye className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium">What your suki sees</p>
                </div>
                <FormPreviewBody items={items} />
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <Sheet
        open={previewOpen && !isDesktop}
        onOpenChange={(open) => setPreviewOpen(open)}
      >
        <SheetContent side={side} className={sheetSideClass(side)}>
          <SheetHeader>
            <SheetTitle>What your suki sees</SheetTitle>
            <SheetDescription>
              The form exactly as it looks on their phone.
            </SheetDescription>
          </SheetHeader>
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-4">
            <FormPreviewBody items={items} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <SheetContent side={side} className={sheetSideClass(side)}>
          <SheetHeader>
            <SheetTitle>
              {editing?.field ? "Edit question" : "New question"}
            </SheetTitle>
            <SheetDescription>
              Ask only what you truly need — every extra box is one more reason
              to give up.
            </SheetDescription>
          </SheetHeader>

          {editing ? (
            <FieldEditor
              key={editing.field?.id ?? "new"}
              calendarId={calendarId}
              field={editing.field}
              onClose={() => setEditing(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !removing) setDeleting(null)
        }}
      >
        {deleting ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete “{deleting.label}”?</DialogTitle>
              <DialogDescription>
                It comes off the form right away. Answers already given on past
                bookings stay where they are.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose
                render={<Button variant="outline" className="h-11 lg:h-9" />}
              >
                Keep it
              </DialogClose>
              <Button
                variant="destructive"
                className="h-11 lg:h-9"
                disabled={removing}
                onClick={confirmDelete}
              >
                <Trash2 />
                {removing ? "Removing…" : "Delete question"}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * One question in the list
 * ------------------------------------------------------------------ */

function QuestionCard({
  field,
  index,
  total,
  busy,
  onEdit,
  onDelete,
  onMove,
}: {
  field: BookingFormFieldRow
  index: number
  total: number
  busy: boolean
  onEdit: () => void
  onDelete: () => void
  onMove: (direction: -1 | 1) => void
}) {
  const def = resolveFieldType(field.type)
  const choices = def.hasOptions
    ? summariseChoices(cleanChoices(field.options ?? []))
    : null

  return (
    <li className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-shadow focus-within:ring-2 focus-within:ring-ring/50">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${field.label}`}
        className="flex w-full items-start gap-3 p-3 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 lg:gap-4 lg:p-4"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-chart-1/12 text-chart-1 lg:size-10">
          <FieldIcon name={def.icon} className="size-4 lg:size-5" />
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium lg:text-base">
              {field.label}
            </span>
            {field.required ? (
              <Badge variant="secondary" className="shrink-0">
                Required
              </Badge>
            ) : null}
          </span>

          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="shrink-0">{def.label}</span>
            {choices ? (
              <>
                <span aria-hidden="true" className="shrink-0">
                  ·
                </span>
                <span className="min-w-0 truncate">{choices}</span>
              </>
            ) : null}
          </span>
        </span>

        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
      </button>

      {/* Buttons, not dragging: a thumb can hit these, and so can a keyboard. */}
      <div className="flex items-center justify-between gap-1 border-t border-border bg-muted/30 px-1.5 py-1">
        <div className="flex items-center">
          <Button
            id={`move-up-${field.id}`}
            variant="ghost"
            size="icon"
            className="size-11 lg:size-9"
            aria-label={`Move ${field.label} up`}
            disabled={busy || index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp />
          </Button>
          <Button
            id={`move-down-${field.id}`}
            variant="ghost"
            size="icon"
            className="size-11 lg:size-9"
            aria-label={`Move ${field.label} down`}
            disabled={busy || index === total - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
          </Button>
          <span className="ml-1 text-xs tabular-nums text-muted-foreground">
            {index + 1} of {total}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="size-11 text-muted-foreground hover:text-destructive lg:size-9"
          aria-label={`Delete ${field.label}`}
          disabled={busy}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ *
 * Nothing here yet
 * ------------------------------------------------------------------ */

function EmptyState({
  busyLabel,
  disabled,
  onAdd,
  onStarter,
}: {
  busyLabel: string | null
  disabled: boolean
  onAdd: () => void
  onStarter: (starter: FieldDraft) => void
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/60 p-5 text-center lg:p-8">
      <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-chart-1/12 text-chart-1">
        <Sparkles className="size-5" />
      </span>

      <h4 className="mt-3 text-base font-medium lg:text-lg">
        No extra questions yet
      </h4>
      <p className="mx-auto mt-1.5 max-w-prose text-sm text-pretty text-muted-foreground">
        Every booking already brings you a name and the time they picked — you
        never have to ask for those. These are the extra things you want to
        know before they arrive.
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {STARTER_FIELDS.map((starter) => (
          <Button
            key={starter.label}
            variant="outline"
            className="h-11 w-full justify-start gap-2 sm:justify-center"
            disabled={disabled}
            onClick={() => onStarter(starter)}
          >
            <FieldIcon
              name={resolveFieldType(starter.type).icon}
              className="size-4"
            />
            <span className="truncate">
              {busyLabel === starter.label ? "Adding…" : starter.label}
            </span>
          </Button>
        ))}
      </div>

      <Button className="mt-5 h-11" disabled={disabled} onClick={onAdd}>
        <Plus />
        Write your own
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * The whole form, as the client meets it
 * ------------------------------------------------------------------ */

function FormPreviewBody({ items }: { items: BookingFormFieldRow[] }) {
  return (
    <div className="space-y-5 p-4">
      <div className="rounded-lg bg-muted/50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Lock className="size-3" />
          Always asked
        </p>
        <p className="mt-1 text-sm text-pretty">
          Their name, how to reach them, and the slot they tap.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-pretty text-muted-foreground">
          No extra questions yet — booking is one tap and done.
        </p>
      ) : (
        items.map((field) => <FieldPreview key={field.id} field={field} />)
      )}

      <Button className="h-11 w-full" disabled>
        Confirm booking
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * The editor
 * ------------------------------------------------------------------ */

export interface FieldEditorProps {
  calendarId: string
  /** null adds a new question. */
  field: BookingFormFieldRow | null
  onClose: () => void
}

/**
 * Lives inside the Sheet, but takes no part in opening or closing it — which
 * is what lets it be rendered on its own.
 */
export function FieldEditor({ calendarId, field, onClose }: FieldEditorProps) {
  const [draft, setDraft] = useState<FieldDraft>(() => draftFromField(field))
  const [error, setError] = useState<string | null>(null)
  const [pickingType, setPickingType] = useState(field === null)
  const [answer, setAnswer] = useState<AnswerValue>(null)
  const [saving, startSaving] = useTransition()

  // Two builders on one page would otherwise fight over the same DOM ids.
  const uid = useId()
  const labelId = `${uid}-label`
  const helpId = `${uid}-help`
  const placeholderId = `${uid}-placeholder`
  const requiredId = `${uid}-required`

  const def = resolveFieldType(draft.type)
  // Two reasons to hide the box: `saveField` drops a placeholder on anything
  // that is not a single-line control, and a date box paints its own hint, so
  // one written there would never be seen.
  const takesPlaceholder = def.singleLine && draft.type !== "date"

  // A stand-in row so the preview can use the very same component the public
  // form does. Its id is its own, so it can never collide with a real field
  // rendered elsewhere on the page.
  const previewField: BookingFormFieldRow = {
    id: `${uid}-preview`,
    calendar_id: calendarId,
    user_id: field?.user_id ?? "",
    label: draft.label.trim() || "Your question",
    type: draft.type,
    help: draft.help.trim() || null,
    placeholder: (takesPlaceholder && draft.placeholder.trim()) || null,
    required: draft.required,
    options: def.hasOptions ? cleanChoices(draft.options) : [],
    position: field?.position ?? 0,
    created_at: field?.created_at ?? "",
    updated_at: field?.updated_at ?? "",
  }

  function patch(changes: Partial<FieldDraft>) {
    setDraft((current) => ({ ...current, ...changes }))
    setError(null)
  }

  function chooseType(next: BookingFieldType) {
    setDraft((current) => ({
      ...current,
      type: next,
      // Two empty rows are the shape of a choice question; an empty list just
      // looks like there is nothing to do.
      options:
        resolveFieldType(next).hasOptions && current.options.length < CHOICES_MIN
          ? ["", ""]
          : current.options,
    }))
    // An answer picked for the old type rarely makes sense for the new one.
    setAnswer(null)
    setError(null)
    setPickingType(false)
  }

  function setChoice(index: number, value: string) {
    setDraft((current) => {
      const options = [...current.options]
      options[index] = value
      return { ...current, options }
    })
    setError(null)
  }

  function addChoice() {
    setDraft((current) => ({ ...current, options: [...current.options, ""] }))
    setError(null)
  }

  function removeChoice(index: number) {
    setDraft((current) => ({
      ...current,
      options: current.options.filter((_, i) => i !== index),
    }))
    setAnswer(null)
    setError(null)
  }

  function save() {
    const problem = validateFieldDraft(draft)
    if (problem) {
      setError(problem)
      toast.error(problem)
      return
    }
    setError(null)

    const payload = draftPayload(draft)
    startSaving(async () => {
      try {
        const result = field
          ? await saveField({ calendarId, fieldId: field.id, ...payload })
          : await saveField({ calendarId, ...payload })

        if (!result.ok) {
          const message = result.message ?? COULD_NOT_SAVE
          setError(message)
          toast.error(message)
          return
        }
        toast.success(field ? "Question updated." : "Question added. Salamat!")
        onClose()
      } catch {
        setError(SOMETHING_WRONG)
        toast.error(SOMETHING_WRONG)
      }
    })
  }

  return (
    <>
      <div className="no-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-2">
        {/* Type ------------------------------------------------------- */}
        <div className="space-y-2">
          <Label className="text-sm">Question type</Label>

          {/* One column inside the `lg` side rail, which is only `max-w-md`
              wide — `xl` never makes that panel any wider. */}
          {pickingType ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {FIELD_TYPES.map((option) => {
                const active = option.type === draft.type
                return (
                  <button
                    key={option.type}
                    type="button"
                    aria-pressed={active}
                    onClick={() => chooseType(option.type)}
                    className={cn(
                      "flex min-h-16 items-start gap-3 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                      active
                        ? "border-primary bg-primary/8"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <FieldIcon name={option.icon} className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-pretty text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPickingType(true)}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-chart-1/12 text-chart-1">
                <FieldIcon name={def.icon} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{def.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {def.description}
                </span>
              </span>
              <span className="shrink-0 text-sm font-medium text-primary">
                Change
              </span>
            </button>
          )}
        </div>

        {/* Wording --------------------------------------------------- */}
        <div className="space-y-2">
          <Label htmlFor={labelId} className="text-sm">
            What are you asking?
          </Label>
          <Input
            id={labelId}
            value={draft.label}
            maxLength={LABEL_MAX}
            placeholder="Mobile number"
            className="h-11"
            onChange={(event) => patch({ label: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={helpId} className="text-sm">
            Hint{" "}
            <span className="font-normal text-muted-foreground">· optional</span>
          </Label>
          <Textarea
            id={helpId}
            rows={2}
            value={draft.help}
            maxLength={HELP_MAX}
            placeholder="A small line under the question."
            onChange={(event) => patch({ help: event.target.value })}
          />
        </div>

        {takesPlaceholder ? (
          <div className="space-y-2">
            <Label htmlFor={placeholderId} className="text-sm">
              Placeholder{" "}
              <span className="font-normal text-muted-foreground">
                · optional
              </span>
            </Label>
            <Input
              id={placeholderId}
              value={draft.placeholder}
              maxLength={PLACEHOLDER_MAX}
              placeholder="Faint grey text inside the box"
              className="h-11"
              onChange={(event) => patch({ placeholder: event.target.value })}
            />
          </div>
        ) : null}

        {/* Choices --------------------------------------------------- */}
        {def.hasOptions ? (
          <div className="space-y-2">
            <Label className="text-sm">Choices</Label>
            <div className="space-y-2">
              {draft.options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={option}
                    aria-label={`Choice ${index + 1}`}
                    placeholder={`Choice ${index + 1}`}
                    className="h-11"
                    onChange={(event) => setChoice(index, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        addChoice()
                      }
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove choice ${index + 1}`}
                    disabled={draft.options.length <= 1}
                    onClick={() => removeChoice(index)}
                  >
                    <X />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              className="h-11 w-full"
              onClick={addChoice}
            >
              <Plus />
              Add choice
            </Button>
            <p className="text-xs text-muted-foreground">
              Blank rows are dropped when you save. Two choices is the minimum.
            </p>
          </div>
        ) : null}

        {/* Required -------------------------------------------------- */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
          <div className="min-w-0">
            <p id={requiredId} className="text-sm font-medium">
              Required
            </p>
            <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
              They cannot finish booking without answering.
            </p>
          </div>
          <Switch
            checked={draft.required}
            aria-labelledby={requiredId}
            className="shrink-0 cursor-pointer after:-inset-x-3 after:-inset-y-3.5"
            onCheckedChange={(checked) => patch({ required: checked })}
          />
        </div>

        {/* Live preview ---------------------------------------------- */}
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <Eye className="size-3.5" />
            Preview
          </p>
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <FieldPreview
              field={previewField}
              value={answer}
              onChange={setAnswer}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Go on, try it — this is the real thing, not a picture of it.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 space-y-2 px-4 pb-6 lg:border-t lg:border-border lg:pt-4">
        <Button className="h-11 w-full" disabled={saving} onClick={save}>
          {saving ? "Saving…" : field ? "Save changes" : "Add question"}
        </Button>
        <Button
          variant="ghost"
          className="h-11 w-full"
          disabled={saving}
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </>
  )
}

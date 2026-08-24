"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  createCalendar,
  deleteCalendar,
  updateCalendar,
} from "@/features/booking/actions"
import type { BookingCalendarRow } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

/**
 * The presets and their labels are exported so they can be tested on their own,
 * the same way the availability editor's pure helpers are — rendering a Base UI
 * popover in jsdom proves nothing these do not.
 *
 * How long one booking runs. Kept to the lengths a small business actually
 * sells — a free-text minutes box invites 37-minute haircuts and gives the
 * slot grid ragged edges for no gain.
 */
export const DURATIONS = [15, 30, 45, 60, 90]
/** Breathing room after each booking: clean up, travel, catch your breath. */
export const BUFFERS = [0, 5, 10, 15, 30]
/** How far ahead a suki must book, in hours. */
export const NOTICES = [0, 1, 2, 4, 12, 24, 48]

export function minuteLabel(minutes: number): string {
  if (minutes === 0) return "No gap"
  if (minutes < 60) return `${minutes} minutes`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const hourWord = hours === 1 ? "1 hour" : `${hours} hours`
  return rest === 0 ? hourWord : `${hourWord} ${rest} min`
}

export function noticeLabel(hours: number): string {
  if (hours === 0) return "Anytime, even now"
  if (hours < 24) return hours === 1 ? "1 hour ahead" : `${hours} hours ahead`
  const days = Math.round(hours / 24)
  return days === 1 ? "1 day ahead" : `${days} days ahead`
}

/** Keeps a stored value that is not one of our presets from vanishing. */
export function withCurrent(choices: number[], current: number): number[] {
  return choices.includes(current)
    ? choices
    : [...choices, current].sort((a, b) => a - b)
}

function NumberSelect({
  id,
  value,
  choices,
  label,
  disabled,
  onChange,
}: {
  id: string
  value: number
  choices: number[]
  label: (value: number) => string
  disabled: boolean
  onChange: (value: number) => void
}) {
  const items = choices.map((choice) => ({
    label: label(choice),
    value: String(choice),
  }))

  return (
    <Select
      items={items}
      value={String(value)}
      disabled={disabled}
      onValueChange={(next) => {
        // Base UI hands back the item's value; a cleared select gives null,
        // which Number() would happily read as zero.
        const parsed = Number(next ?? NaN)
        if (Number.isFinite(parsed)) onChange(parsed)
      }}
    >
      <SelectTrigger id={id} className="h-11! w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export interface CalendarFormProps {
  mode: "create" | "edit"
  /** Required in edit mode; the row being changed. */
  calendar?: BookingCalendarRow | null
  /** Called after a successful save, with the calendar's id. */
  onSuccess?: (id?: string) => void
  /** Renders a Cancel button — the dialog passes its close handler here. */
  onCancel?: () => void
  className?: string
}

/**
 * One form for both jobs. Creating and editing ask for exactly the same five
 * things, so splitting them would only mean two places to keep in step.
 *
 * Fully controlled rather than relying on the DOM: the selects are Base UI
 * popovers, and building the FormData by hand keeps what is submitted equal to
 * what is on screen.
 */
export function CalendarForm({
  mode,
  calendar = null,
  onSuccess,
  onCancel,
  className,
}: CalendarFormProps) {
  const router = useRouter()
  const uid = React.useId()

  const [name, setName] = React.useState(calendar?.name ?? "")
  const [description, setDescription] = React.useState(
    calendar?.description ?? ""
  )
  const [duration, setDuration] = React.useState(
    calendar?.duration_minutes ?? 30
  )
  const [buffer, setBuffer] = React.useState(calendar?.buffer_minutes ?? 0)
  const [notice, setNotice] = React.useState(calendar?.notice_hours ?? 2)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, startSaving] = React.useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    startSaving(async () => {
      try {
        if (mode === "create") {
          const payload = new FormData()
          payload.set("name", name)
          payload.set("description", description)
          payload.set("durationMinutes", String(duration))
          payload.set("bufferMinutes", String(buffer))
          payload.set("noticeHours", String(notice))

          const result = await createCalendar(payload)
          if (!result.ok) {
            setError(result.message ?? null)
            toast.error(result.message ?? "We could not create that calendar.")
            return
          }
          toast.success(result.message ?? "Calendar created.")
          onSuccess?.(result.id)
          return
        }

        if (!calendar) return
        const result = await updateCalendar({
          calendarId: calendar.id,
          name,
          description,
          durationMinutes: duration,
          bufferMinutes: buffer,
          noticeHours: notice,
        })
        if (!result.ok) {
          setError(result.message ?? null)
          toast.error(result.message ?? "We could not save those changes.")
          return
        }
        toast.success(result.message ?? "Saved.")
        onSuccess?.(result.id)
      } catch {
        const message = "Something went wrong. Please try again."
        setError(message)
        toast.error(message)
      }
    })
  }

  const nameId = `${uid}-name`
  const descriptionId = `${uid}-description`
  const durationId = `${uid}-duration`
  const bufferId = `${uid}-buffer`
  const noticeId = `${uid}-notice`

  return (
    <div className={cn("space-y-6", className)}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={nameId}>What are you booking?</Label>
          <Input
            id={nameId}
            value={name}
            maxLength={80}
            required
            disabled={saving}
            autoComplete="off"
            placeholder="Haircut with Aling Nena"
            className="h-11"
            aria-invalid={error ? true : undefined}
            onChange={(event) => setName(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            This is the title your suki sees on the booking page.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={descriptionId}>Short description</Label>
          <Textarea
            id={descriptionId}
            value={description}
            maxLength={500}
            rows={3}
            disabled={saving}
            placeholder="Wash, cut and blow-dry. Walk-ins welcome kung may bakante."
            className="min-h-24"
            onChange={(event) => setDescription(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Optional. Tell them what to expect, or what to bring.
          </p>
        </div>

        {/* Three short numeric answers: stacked on a phone so every control
            keeps its 44px target, side by side the moment there is room. */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor={durationId}>How long is one booking?</Label>
            <NumberSelect
              id={durationId}
              value={duration}
              choices={withCurrent(DURATIONS, duration)}
              label={minuteLabel}
              disabled={saving}
              onChange={setDuration}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={bufferId}>Gap after each one</Label>
            <NumberSelect
              id={bufferId}
              value={buffer}
              choices={withCurrent(BUFFERS, buffer)}
              label={minuteLabel}
              disabled={saving}
              onChange={setBuffer}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={noticeId}>Book at least</Label>
            <NumberSelect
              id={noticeId}
              value={notice}
              choices={withCurrent(NOTICES, notice)}
              label={noticeLabel}
              disabled={saving}
              onChange={setNotice}
            />
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-pretty text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:px-6"
              disabled={saving}
              onClick={onCancel}
            >
              Cancel
            </Button>
          ) : null}
          <Button
            type="submit"
            className="h-11 gap-2 sm:px-6"
            disabled={saving || name.trim().length < 2}
          >
            {saving ? (
              <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
            ) : null}
            {saving
              ? "Saving…"
              : mode === "create"
                ? "Create calendar"
                : "Save changes"}
          </Button>
        </div>
      </form>

      {mode === "edit" && calendar ? (
        <DeleteCalendar
          calendar={calendar}
          onDeleted={() => router.push("/modules/booking")}
        />
      ) : null}
    </div>
  )
}

/**
 * Deleting takes the public link with it, so the confirmation says so in the
 * words that matter to the owner rather than "this action cannot be undone".
 */
function DeleteCalendar({
  calendar,
  onDeleted,
}: {
  calendar: BookingCalendarRow
  onDeleted: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [removing, startRemoving] = React.useTransition()

  function remove() {
    startRemoving(async () => {
      try {
        const result = await deleteCalendar(calendar.id)
        if (!result.ok) {
          toast.error(result.message ?? "We could not delete that calendar.")
          return
        }
        setOpen(false)
        toast.success(result.message ?? "Calendar deleted.")
        onDeleted()
      } catch {
        toast.error("Something went wrong. Please try again.")
      }
    })
  }

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-medium text-foreground">
            Delete this calendar
          </h3>
          <p className="max-w-prose text-sm text-pretty text-muted-foreground">
            The link stops working and every booking already taken on it is
            removed with it.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button
                variant="destructive"
                className="h-11 w-full shrink-0 gap-2 sm:w-auto"
              />
            }
          >
            <Trash2 aria-hidden="true" />
            Delete
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete “{calendar.name}”?</DialogTitle>
              <DialogDescription>
                {calendar.is_published
                  ? "This link is live right now. Anyone who has it will get a page that no longer exists."
                  : "This calendar is still a draft, so nobody outside your account will notice."}{" "}
                Its hours, closed dates, questions and bookings all go with it.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <DialogClose
                render={<Button variant="outline" className="h-11" />}
              >
                Keep it
              </DialogClose>
              <Button
                variant="destructive"
                className="h-11"
                disabled={removing}
                onClick={remove}
              >
                {removing ? "Deleting…" : "Yes, delete it"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

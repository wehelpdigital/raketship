"use client"

/**
 * The customer's side of a booking link: pick a day, pick a time, say who you
 * are, confirm.
 *
 * Two rules shape the whole thing. First, availability is never computed here —
 * the browser asks the server for the times each time the date changes, so a
 * slot someone took thirty seconds ago is already gone. Second, every date is
 * formatted from its ISO parts rather than through the visitor's locale, so the
 * server render and the hydrated render always agree.
 */

import * as React from "react"
import { CalendarCheck, CalendarOff, Check, ChevronLeft, Clock, Globe } from "lucide-react"

import { Spinner } from "@/components/shell/loader"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FieldPreview } from "@/features/booking/field-preview"
import {
  getAvailableSlots,
  submitBooking,
  type EmptyReason,
} from "@/features/booking/public-actions"
import { validateAnswers, type AnswerValue } from "@/lib/booking/fields"
import {
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  type Slot,
} from "@/lib/booking/slots"
import type { BookingFormFieldRow } from "@/lib/supabase/types"
import { useViewerTimezone } from "@/lib/hooks/client"
import { cn } from "@/lib/utils"

// -----------------------------------------------------------------------------
// Dates, formatted from their parts so nothing depends on the viewer's locale
// -----------------------------------------------------------------------------

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

function partsOf(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number)
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 }
}

/** 0 = Sunday. The ISO date is already the local date, so UTC is safe here. */
function weekdayOfIso(iso: string): number {
  const { year, month, day } = partsOf(iso)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** "Monday, 1 March". */
function longDate(iso: string): string {
  const { month, day } = partsOf(iso)
  return `${WEEKDAY_LABELS[weekdayOfIso(iso)]}, ${day} ${MONTHS[month - 1]}`
}

// -----------------------------------------------------------------------------
// Static class maps — never interpolated, so the Tailwind scanner sees them all
// -----------------------------------------------------------------------------

type StepState = "done" | "current" | "todo"

const STEP_MARK: Record<StepState, string> = {
  done: "bg-primary text-primary-foreground ring-primary/25",
  current: "bg-primary/12 text-primary ring-primary/40",
  todo: "bg-muted text-muted-foreground ring-transparent",
}

const STEP_LABEL: Record<StepState, string> = {
  done: "text-foreground",
  current: "text-foreground",
  todo: "text-muted-foreground",
}

const EMPTY_COPY: Record<EmptyReason, { title: string; body: string }> = {
  closed: {
    title: "Closed that day",
    body: "Walang bukás na oras sa petsang ito. Pumili po tayo ng ibang araw.",
  },
  blacked_out: {
    title: "Closed that day",
    body: "Naka-block ang petsang ito. Subukan po natin ang ibang araw.",
  },
  full: {
    title: "Fully booked",
    body: "Naubos na ang lahat ng oras dito. May bakante pa sa ibang araw.",
  },
  // Covers both ends of the notice window: the day already gone, and a day so
  // soon that the cut-off for booking it has passed.
  passed: {
    title: "Sarado na para sa araw na ito",
    body: "Lampas na sa oras ng pagpapa-book dito. May bakante pa sa ibang araw.",
  },
  unavailable: {
    title: "No times to show",
    body: "Walang maiaalok na oras para sa petsang ito.",
  },
}

// -----------------------------------------------------------------------------

export interface BookingDay {
  iso: string
  /** Precomputed on the server, so a shut day is greyed out before any tap. */
  open: boolean
}

export interface BookingFlowProps {
  calendarId: string
  calendarName: string
  durationMinutes: number
  /** IANA zone the labels are written in, e.g. "Asia/Manila". */
  timezone: string
  /** "Manila · GMT+8", built server-side. */
  timezoneLabel: string
  fields: BookingFormFieldRow[]
  /** The next fortnight, starting today in the calendar's own zone. */
  days: BookingDay[]
}

type SlotState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; slots: Slot[]; reason?: EmptyReason }
  | { status: "error"; message: string }

/**
 * What the last fetch returned, tagged with the date it was for. "Loading" is
 * not stored: it is simply the state of holding a result for a different date
 * than the one selected, which makes the two impossible to disagree.
 */
type LoadedSlots =
  | { status: "empty" }
  | { status: "ready"; forDate: string; slots: Slot[]; reason?: EmptyReason }
  | { status: "error"; forDate: string; message: string }

interface Confirmation {
  bookingId?: string
  isoDate: string
  slot: Slot
}

/**
 * The list minus any time the server has already refused. If that empties it,
 * the day really is full — whatever the fresh list happened to say.
 */
function withoutRefused(state: SlotState, gone: string[]): SlotState {
  if (state.status !== "ready" || gone.length === 0) return state
  const slots = state.slots.filter((slot) => !gone.includes(slot.startsAt))
  return {
    status: "ready",
    slots,
    reason: slots.length === 0 ? (state.reason ?? "full") : state.reason,
  }
}

export function BookingFlow({
  calendarId,
  calendarName,
  durationMinutes,
  timezone,
  timezoneLabel,
  fields,
  days,
}: BookingFlowProps) {
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null)
  const [loaded, setLoaded] = React.useState<LoadedSlots>({ status: "empty" })
  const [selectedSlot, setSelectedSlot] = React.useState<Slot | null>(null)
  const [reloadToken, setReloadToken] = React.useState(0)
  /**
   * Times the server has already refused, by absolute instant.
   *
   * Refetching after a collision is not always enough: the read that decides
   * what is taken is owner-scoped, so a fresh list can hand a customer the very
   * slot they were just turned away from, over and over. Once a time is
   * refused, it stops being offered here whatever the next list says.
   */
  const [gone, setGone] = React.useState<string[]>([])

  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [answers, setAnswers] = React.useState<Record<string, AnswerValue>>({})

  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [confirmed, setConfirmed] = React.useState<Confirmation | null>(null)

  const [stepIndex, setStepIndex] = React.useState(0)
  const timesRef = React.useRef<HTMLDivElement>(null)
  const formRef = React.useRef<HTMLDivElement>(null)
  const requestRef = React.useRef(0)

  // The viewer's own zone, known only after hydration — reading it during
  // render would make the server and client markup disagree. Null while it
  // matches the calendar's zone, so the "times shown in..." note stays quiet.
  const detectedZone = useViewerTimezone()
  const viewerZone = detectedZone && detectedZone !== timezone ? detectedZone : null

  const slotState: SlotState = React.useMemo(() => {
    if (!selectedDate) return { status: "idle" }
    if (loaded.status !== "empty" && loaded.forDate === selectedDate) {
      return loaded.status === "ready"
        ? { status: "ready", slots: loaded.slots, reason: loaded.reason }
        : { status: "error", message: loaded.message }
    }
    return { status: "loading" }
  }, [selectedDate, loaded])

  // --- slots ----------------------------------------------------------------
  React.useEffect(() => {
    if (!selectedDate) return

    const isoDate = selectedDate
    const ticket = ++requestRef.current
    let cancelled = false

    getAvailableSlots({ calendarId, isoDate })
      .then((result) => {
        if (cancelled || ticket !== requestRef.current) return
        if (!result.ok) {
          setLoaded({
            status: "error",
            forDate: isoDate,
            message: result.message ?? "We could not load the times.",
          })
          return
        }
        setLoaded({
          status: "ready",
          forDate: isoDate,
          slots: result.slots,
          reason: result.reason,
        })
      })
      .catch(() => {
        if (cancelled || ticket !== requestRef.current) return
        setLoaded({
          status: "error",
          forDate: isoDate,
          message: "We could not load the times. Pakisubukan ulit.",
        })
      })

    return () => {
      cancelled = true
    }
  }, [calendarId, selectedDate, reloadToken])

  /** Phone only — desktop already shows every step at once. */
  function revealOnPhone(target: React.RefObject<HTMLDivElement | null>) {
    if (typeof window === "undefined") return
    if (window.innerWidth >= 1024) return
    window.requestAnimationFrame(() => {
      target.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  }

  function pickDate(iso: string) {
    setSelectedDate(iso)
    setSelectedSlot(null)
    setFormError(null)
    setStepIndex(1)
    revealOnPhone(timesRef)
  }

  function pickSlot(slot: Slot) {
    setSelectedSlot(slot)
    setFormError(null)
    setStepIndex(2)
    revealOnPhone(formRef)
  }

  function goBack() {
    setFormError(null)
    setStepIndex(Math.max(0, step - 1))
  }

  /** Only backwards, and only to a step already completed. */
  function goToStep(target: number) {
    if (target > furthest || target === step) return
    setFormError(null)
    setStepIndex(target)
  }

  function answersForFields(): Record<string, AnswerValue> {
    const next: Record<string, AnswerValue> = {}
    for (const field of fields) next[field.id] = answers[field.id] ?? null
    return next
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedSlot || !selectedDate || submitting) return

    // A first pass in the browser so obvious gaps are caught without a round
    // trip. The server runs the same checks again and does not trust these.
    const found: Record<string, string> = {}
    if (!name.trim()) found.name = "Pakilagay po ang pangalan mo."
    if (!email.trim() && !phone.trim()) {
      found.contact = "Give an email or a mobile number so we can reach you."
    }
    Object.assign(found, validateAnswers(fields, answersForFields()))

    if (Object.keys(found).length > 0) {
      setErrors(found)
      setFormError("Kulang pa po ang ilang detalye.")
      return
    }

    setErrors({})
    setFormError(null)
    setSubmitting(true)

    try {
      const result = await submitBooking({
        calendarId,
        startsAt: selectedSlot.startsAt,
        customerName: name.trim(),
        customerEmail: email.trim() || null,
        customerPhone: phone.trim() || null,
        answers: answersForFields(),
      })

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        setFormError(result.message ?? "We could not save that booking.")
        if (result.retry) {
          // Someone else got there first — retire that time and send them back
          // to a fresh list.
          const lost = selectedSlot.startsAt
          setGone((previous) =>
            previous.includes(lost) ? previous : [...previous, lost]
          )
          setSelectedSlot(null)
          setReloadToken((token) => token + 1)
          revealOnPhone(timesRef)
        }
        return
      }

      setConfirmed({
        bookingId: result.bookingId,
        isoDate: selectedDate,
        slot: selectedSlot,
      })
    } catch {
      setFormError("Something went wrong. Pakisubukan ulit in a moment.")
    } finally {
      setSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Done
  // ---------------------------------------------------------------------------
  if (confirmed) {
    return (
      <Confirmed
        calendarName={calendarName}
        confirmation={confirmed}
        durationMinutes={durationMinutes}
        timezoneLabel={timezoneLabel}
        viewerZone={viewerZone}
      />
    )
  }

  // A wizard needs to go back without losing a choice, so the step is state.
  // Clamping it against what has actually been picked means it can never sit
  // ahead of the data — no effect has to chase it back into range.
  const furthest = selectedSlot ? 2 : selectedDate ? 1 : 0
  const step = Math.min(stepIndex, furthest)
  const offered = withoutRefused(slotState, gone)

  return (
    <div className="space-y-4 lg:space-y-5">
      <Stepper current={step} furthest={furthest} onGoTo={goToStep} />

      {/*
        A wizard: exactly one step on screen. Only the step being worked on is
        mounted, so a phone never scrolls past three stacked cards and the
        person is never looking at a choice they have not reached.
      */}
      <div className="space-y-4">
        {step === 0 ? (
          <div key="step-date" className="step-enter">
            {/* --- 1. the day ---------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarCheck className="size-4 text-primary" aria-hidden />
                Pumili ng petsa
              </CardTitle>
              <CardDescription>The next two weeks.</CardDescription>
            </CardHeader>
            <CardContent>
              <DayPicker
                days={days}
                selected={selectedDate}
                onPick={pickDate}
              />
            </CardContent>
          </Card>

          </div>
        ) : null}

        {step === 1 ? (
          <div key="step-time" ref={timesRef} className="step-enter scroll-mt-20">
            {selectedDate ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Clock className="size-4 text-primary" aria-hidden />
                    Pumili ng oras
                  </CardTitle>
                  <CardDescription>{longDate(selectedDate)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <TimePicker
                    state={offered}
                    selected={selectedSlot}
                    onPick={pickSlot}
                  />
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Globe className="size-3.5 shrink-0" aria-hidden />
                    All times are in {timezoneLabel}
                  </p>
                </CardContent>
              </Card>
            ) : null}
            <BackRow onBack={goBack} label="Ibang petsa" />
          </div>
        ) : null}

        {step === 2 ? (
          <div key="step-details" ref={formRef} className="step-enter scroll-mt-20">
            {selectedSlot && selectedDate ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Your details</CardTitle>
                <CardDescription>
                  Para may pangalan at paraan kaming abutin ka.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <BookingSummary
                  calendarName={calendarName}
                  isoDate={selectedDate}
                  slot={selectedSlot}
                  durationMinutes={durationMinutes}
                  timezoneLabel={timezoneLabel}
                  viewerZone={viewerZone}
                />

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <Label htmlFor="booking-name" className="gap-1">
                      Pangalan
                      <span className="text-destructive" aria-hidden>
                        *
                      </span>
                    </Label>
                    <Input
                      id="booking-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      placeholder="Juan dela Cruz"
                      className="h-11"
                      disabled={submitting}
                      aria-invalid={errors.name ? true : undefined}
                      aria-describedby={errors.name ? "booking-name-error" : undefined}
                    />
                    {errors.name ? (
                      <p id="booking-name-error" className="text-sm text-destructive">
                        {errors.name}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="booking-email">Email</Label>
                      <Input
                        id="booking-email"
                        type="email"
                        inputMode="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        placeholder="juan@email.com"
                        className="h-11"
                        disabled={submitting}
                        aria-invalid={errors.contact ? true : undefined}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="booking-phone">Mobile</Label>
                      <Input
                        id="booking-phone"
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        autoComplete="tel"
                        placeholder="0917 000 0000"
                        className="h-11"
                        disabled={submitting}
                        aria-invalid={errors.contact ? true : undefined}
                      />
                    </div>
                  </div>

                  {errors.contact ? (
                    <p className="text-sm text-destructive">{errors.contact}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Kahit isa lang — email o mobile. Iyan ang gagamitin para
                      kumpirmahin ang booking mo.
                    </p>
                  )}

                  {fields.length > 0 ? (
                    <div className="space-y-4 border-t border-border pt-4">
                      {fields.map((field) => (
                        <FieldPreview
                          key={field.id}
                          field={field}
                          value={answers[field.id] ?? null}
                          onChange={(value: AnswerValue) =>
                            setAnswers((previous) => ({
                              ...previous,
                              [field.id]: value,
                            }))
                          }
                          disabled={submitting}
                          error={errors[field.id]}
                        />
                      ))}
                    </div>
                  ) : null}

                  {formError ? (
                    <p
                      role="alert"
                      className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      {formError}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="h-11 w-full"
                  >
                    {submitting ? "Booking…" : "Confirm booking"}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    Walang bayad dito. Sa {calendarName} na ang usapan pagdating
                    mo.
                  </p>
                </form>
              </CardContent>
            </Card>
            ) : null}
            <BackRow onBack={goBack} label="Ibang oras" />
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * The way back out of a step. Deliberately quiet — going forward is the
 * action, and a Back button competing with it costs taps on a phone.
 */
function BackRow({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <div className="mt-3 flex">
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        className="h-11 gap-1.5 px-3 text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {label}
      </Button>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Pieces
// -----------------------------------------------------------------------------

const STEPS = ["Petsa", "Oras", "Detalye"] as const

function Stepper({
  current,
  furthest,
  onGoTo,
}: {
  current: number
  furthest: number
  onGoTo: (index: number) => void
}) {
  return (
    <ol
      aria-label="Booking steps"
      className="flex items-center gap-2 rounded-xl bg-card px-3 py-2.5 ring-1 ring-border sm:gap-3 sm:px-4"
    >
      {STEPS.map((label, index) => {
        const state: StepState =
          index < current ? "done" : index === current ? "current" : "todo"
        // A finished step is a way back to a decision already made. A step
        // not yet reached is not a link to anywhere.
        const reachable = index < current && index <= furthest
        const Mark = reachable ? "button" : "span"
        return (
          <li
            key={label}
            aria-current={state === "current" ? "step" : undefined}
            className="flex min-w-0 flex-1 items-center gap-2 last:flex-none"
          >
            <Mark
              {...(reachable
                ? {
                    type: "button" as const,
                    onClick: () => onGoTo(index),
                    "aria-label": `Bumalik sa ${label}`,
                  }
                : {})}
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-2 transition-colors sm:size-7 sm:text-xs",
                STEP_MARK[state],
                reachable &&
                  "cursor-pointer outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
              )}
            >
              {state === "done" ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                index + 1
              )}
            </Mark>
            <span
              className={cn(
                "truncate text-xs font-medium transition-colors sm:text-sm",
                STEP_LABEL[state]
              )}
            >
              {label}
            </span>
            {index < STEPS.length - 1 ? (
              <span
                aria-hidden
                className="h-px min-w-2 flex-1 bg-border sm:min-w-4"
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function DayPicker({
  days,
  selected,
  onPick,
}: {
  days: BookingDay[]
  selected: string | null
  onPick: (iso: string) => void
}) {
  if (days.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        Walang bukás na petsa sa ngayon.
      </p>
    )
  }

  // The fortnight rarely starts on a Sunday, so the month grid needs blanks in
  // front of it to land each date under the right weekday column.
  const lead = weekdayOfIso(days[0].iso)
  const cells: (BookingDay | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...days,
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const relative = (index: number, iso: string) =>
    index === 0 ? "Today" : index === 1 ? "Bukas" : MONTHS[partsOf(iso).month - 1].slice(0, 3)

  return (
    <>
      {/* Phone and tablet: a thumb-friendly rail. */}
      <div className="no-scrollbar snap-x snap-mandatory overflow-x-auto pb-1 lg:hidden">
        <div className="flex w-max gap-2">
          {days.map((day, index) => {
            const active = day.iso === selected
            return (
              <button
                key={day.iso}
                type="button"
                disabled={!day.open}
                onClick={() => onPick(day.iso)}
                aria-pressed={active}
                aria-label={`${longDate(day.iso)}${day.open ? "" : " — walang bakante"}`}
                className={cn(
                  "flex h-19 w-15 shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-xl ring-1 transition-colors",
                  active
                    ? "bg-primary text-primary-foreground ring-primary"
                    : day.open
                      ? "bg-card text-foreground ring-border hover:bg-muted"
                      : "cursor-not-allowed bg-muted/40 text-muted-foreground/60 ring-transparent"
                )}
              >
                <span className="text-[10px] font-medium tracking-wide uppercase">
                  {WEEKDAY_SHORT[weekdayOfIso(day.iso)]}
                </span>
                <span className="text-lg leading-none font-semibold tabular-nums">
                  {partsOf(day.iso).day}
                </span>
                <span className="text-[10px] opacity-80">
                  {relative(index, day.iso)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Desktop: a month-shaped grid, which is what a calendar looks like. */}
      <div className="hidden lg:block">
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {WEEKDAY_SHORT.map((short) => (
            <span key={short}>{short}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, index) =>
            cell === null ? (
              <span key={`pad-${index}`} className="h-11" aria-hidden />
            ) : (
              <button
                key={cell.iso}
                type="button"
                disabled={!cell.open}
                onClick={() => onPick(cell.iso)}
                aria-pressed={cell.iso === selected}
                aria-label={longDate(cell.iso)}
                className={cn(
                  "relative flex h-11 items-center justify-center rounded-lg text-sm font-medium tabular-nums ring-1 transition-colors",
                  cell.iso === selected
                    ? "bg-primary text-primary-foreground ring-primary"
                    : cell.open
                      ? "bg-card text-foreground ring-border hover:bg-muted"
                      : "cursor-not-allowed bg-muted/30 text-muted-foreground/50 ring-transparent"
                )}
              >
                {partsOf(cell.iso).day}
                {cell.open && cell.iso !== selected ? (
                  <span
                    aria-hidden
                    className="absolute bottom-1.5 size-1 rounded-full bg-primary"
                  />
                ) : null}
              </button>
            )
          )}
        </div>
      </div>
    </>
  )
}

function TimePicker({
  state,
  selected,
  onPick,
}: {
  state: SlotState
  selected: Slot | null
  onPick: (slot: Slot) => void
}) {
  if (state.status === "loading" || state.status === "idle") {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Spinner className="size-4" label="Loading times" />
        Tinitingnan ang bakante…
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="rounded-lg bg-destructive/10 px-3 py-3 text-sm text-destructive">
        {state.message}
      </div>
    )
  }

  if (state.slots.length === 0) {
    const copy = EMPTY_COPY[state.reason ?? "unavailable"]
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-lg bg-muted/40 px-4 py-6 text-center">
        <CalendarOff className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">{copy.title}</p>
        <p className="max-w-64 text-xs text-pretty text-muted-foreground">
          {copy.body}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:max-h-72 lg:grid-cols-2 lg:overflow-y-auto lg:pr-1 xl:grid-cols-3">
      {state.slots.map((slot) => {
        const active = slot.startsAt === selected?.startsAt
        return (
          <button
            key={slot.startsAt}
            type="button"
            onClick={() => onPick(slot)}
            aria-pressed={active}
            className={cn(
              "h-11 rounded-lg text-sm font-medium tabular-nums ring-1 transition-colors",
              active
                ? "bg-primary text-primary-foreground ring-primary"
                : "bg-card text-foreground ring-border hover:bg-muted"
            )}
          >
            {slot.label}
          </button>
        )
      })}
    </div>
  )
}

/** What they are about to book, restated before the button that commits it. */
function BookingSummary({
  calendarName,
  isoDate,
  slot,
  durationMinutes,
  timezoneLabel,
  viewerZone,
}: {
  calendarName: string
  isoDate: string
  slot: Slot
  durationMinutes: number
  timezoneLabel: string
  viewerZone: string | null
}) {
  return (
    <div className="space-y-1 rounded-lg bg-primary/8 p-3 ring-1 ring-primary/20">
      <p className="text-sm font-semibold text-balance">{calendarName}</p>
      <p className="text-sm">
        {longDate(isoDate)} · <span className="font-medium">{slot.label}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {durationMinutes} minutes · {timezoneLabel}
      </p>
      <LocalTimeNote startsAt={slot.startsAt} viewerZone={viewerZone} />
    </div>
  )
}

/**
 * Rendered only once the viewer's zone is known to differ, which is after
 * mount — so this never appears in the server markup and never mismatches.
 */
function LocalTimeNote({
  startsAt,
  viewerZone,
}: {
  startsAt: string
  viewerZone: string | null
}) {
  if (!viewerZone) return null

  let local: string
  try {
    local = new Intl.DateTimeFormat("en-PH", {
      timeZone: viewerZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(startsAt))
  } catch {
    return null
  }

  return (
    <p className="text-xs text-muted-foreground">
      Sa device mo ({viewerZone}) ito ay {local}.
    </p>
  )
}

function Confirmed({
  calendarName,
  confirmation,
  durationMinutes,
  timezoneLabel,
  viewerZone,
}: {
  calendarName: string
  confirmation: Confirmation
  durationMinutes: number
  timezoneLabel: string
  viewerZone: string | null
}) {
  const reference = confirmation.bookingId?.slice(0, 8).toUpperCase()

  return (
    <Card>
      <CardContent className="space-y-4 py-8 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-chart-3/15 text-chart-3">
          <Check className="size-7" aria-hidden />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">
            Booked na po!
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">
            Nakalista ka na sa {calendarName}. Salamat, suki.
          </p>
        </div>

        <div className="mx-auto max-w-sm space-y-1 rounded-xl bg-muted/50 p-4 text-left ring-1 ring-border">
          <p className="text-base font-semibold">
            {longDate(confirmation.isoDate)}
          </p>
          <p className="text-sm font-medium">{confirmation.slot.label}</p>
          <p className="text-xs text-muted-foreground">
            {durationMinutes} minutes · {timezoneLabel}
          </p>
          <LocalTimeNote
            startsAt={confirmation.slot.startsAt}
            viewerZone={viewerZone}
          />
          {reference ? (
            <p className="pt-1 font-mono text-xs text-muted-foreground">
              Ref {reference}
            </p>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          I-screenshot mo na ito para may kopya ka.
        </p>
      </CardContent>
    </Card>
  )
}

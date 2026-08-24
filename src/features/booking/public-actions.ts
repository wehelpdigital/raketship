"use server"

/**
 * The two actions an anonymous visitor is allowed to call.
 *
 * Everything here runs for someone with no session at all, so the rule is that
 * nothing the caller sends is believed on its own:
 *
 *   - the calendar is re-loaded server-side and refused unless it is published;
 *   - the chosen time is re-derived with buildSlots() and rejected if it is not
 *     currently on offer, however plausible it looks;
 *   - every answer is re-checked with validateAnswers();
 *   - the owner (`user_id`) is read from the calendar row, never from input.
 *
 * The RLS policy in 0004 enforces that last point too. This is the belt; that
 * is the braces.
 */

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { validateAnswers, type AnswerValue } from "@/lib/booking/fields"
import {
  buildSlots,
  calendarDatesTouching,
  dayWindowInZone,
  isoDateInZone,
  weekdayInZone,
  withinWindow,
  zonedTimeToInstant,
  type Slot,
  type SlotRules,
} from "@/lib/booking/slots"
import { getTakenSlots } from "@/lib/queries/booking"
import { isKnownTimezone } from "@/lib/booking/timezones"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import type {
  BookingAvailabilityRow,
  BookingBlackoutRow,
  BookingCalendarRow,
  BookingFormFieldRow,
  BookingServiceRow,
} from "@/lib/supabase/types"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** A booking's worth of answers is small; anything bigger is somebody probing. */
const MAX_ANSWER_KEYS = 100

/**
 * The furthest any calendar may reach, whatever it has configured.
 *
 * Mirrors the booking_calendars_horizon_range check constraint. The per-calendar
 * value is the real bound; this is the backstop for a row that predates the
 * column or somehow escapes the constraint.
 */
const ABSOLUTE_MAX_HORIZON_DAYS = 365

const NOT_LIVE =
  "This booking link is not taking bookings right now. Pakitanong po ang may-ari."
const NO_DB = "Bookings are not connected yet, so nothing can be saved."
const OUT_OF_RANGE = "That date is not open for booking. Pumili po ng ibang araw."
const PICK_SERVICE = "Pumili po muna ng serbisyo."

// -----------------------------------------------------------------------------
// Input shapes
// -----------------------------------------------------------------------------

const SlotsInput = z.object({
  calendarId: z.string().regex(UUID_RE),
  isoDate: z.string().regex(ISO_DATE_RE),
  // Optional: an older client, or one whose runtime hid the zone, simply gets
  // the shop's own days.
  viewerZone: z.string().max(64).optional(),
  // Required only when the calendar sells a catalogue; its length cuts the slots.
  serviceId: z.string().regex(UUID_RE).optional(),
})

const AnswerInput = z.union([
  z.string().max(5000),
  z.array(z.string().max(1000)).max(50),
  z.boolean(),
  z.number(),
  z.null(),
])

const SubmitInput = z.object({
  calendarId: z.string().regex(UUID_RE),
  serviceId: z.string().regex(UUID_RE).optional(),
  startsAt: z.string().min(1).max(64),
  customerName: z
    .string()
    .trim()
    .min(1, "Pakilagay po ang pangalan mo.")
    .max(120, "That name is too long."),
  customerEmail: z.string().trim().max(160).nullish(),
  customerPhone: z.string().trim().max(40).nullish(),
  answers: z.record(z.string(), AnswerInput).nullish(),
})

// -----------------------------------------------------------------------------
// Results
// -----------------------------------------------------------------------------

/** Why a day came back with nothing, so the page can say something useful. */
export type EmptyReason =
  | "closed"
  | "blacked_out"
  | "full"
  | "passed"
  | "unavailable"

export interface AvailableSlotsResult {
  ok: boolean
  slots: Slot[]
  /** Only set when `slots` is empty. */
  reason?: EmptyReason
  /** The zone the labels are written in — restated so the UI cannot drift. */
  timezone?: string
  message?: string
}

export interface SubmitBookingResult {
  ok: boolean
  message?: string
  bookingId?: string
  /** True when the customer should go back and pick another time. */
  retry?: boolean
  /** Keyed by form field id, plus "name" / "contact" for the built-ins. */
  fieldErrors?: Record<string, string>
}

export interface SubmitBookingInput {
  calendarId: string
  /** Required when the calendar sells a catalogue. */
  serviceId?: string
  startsAt: string
  customerName: string
  customerEmail?: string | null
  customerPhone?: string | null
  answers?: Record<string, AnswerValue> | null
}

// -----------------------------------------------------------------------------
// Loading — always scoped to a published calendar
// -----------------------------------------------------------------------------

type SupabaseServerClient = NonNullable<
  Awaited<ReturnType<typeof getSupabaseServerClient>>
>

interface PublicCalendar {
  calendar: BookingCalendarRow
  availability: BookingAvailabilityRow[]
  blackouts: BookingBlackoutRow[]
  fields: BookingFormFieldRow[]
  /** Active services, in the owner's order. Empty unless length_mode is 'catalog'. */
  services: BookingServiceRow[]
}

function rulesOf(
  calendar: BookingCalendarRow,
  /** The chosen service's length, when the calendar sells a catalogue. */
  durationMinutes: number = calendar.duration_minutes
): SlotRules {
  return {
    timezone: calendar.timezone,
    durationMinutes,
    bufferMinutes: calendar.buffer_minutes,
    noticeHours: calendar.notice_hours,
  }
}

/**
 * How long this booking runs, and what it was sold as.
 *
 * In catalogue mode the length is not a property of the calendar at all — it
 * belongs to whichever service the customer picked, so it is resolved from the
 * stored row rather than from anything the browser sent. A price arriving in
 * the request would be a price the customer chose for themselves.
 */
function resolveService(
  bundle: PublicCalendar,
  serviceId: string | undefined
):
  | { ok: true; minutes: number; service: BookingServiceRow | null }
  | { ok: false; message: string } {
  if (bundle.calendar.length_mode !== "catalog") {
    return { ok: true, minutes: bundle.calendar.duration_minutes, service: null }
  }

  if (bundle.services.length === 0) {
    // The owner switched to a catalogue and emptied it. Nothing bookable.
    return { ok: false, message: NOT_LIVE }
  }

  const service = serviceId
    ? bundle.services.find((row) => row.id === serviceId)
    : undefined

  if (!service) return { ok: false, message: PICK_SERVICE }

  return { ok: true, minutes: service.duration_minutes, service }
}

/**
 * The calendar plus its rules, or null when it does not exist or is a draft.
 *
 * The published check is made twice on purpose: once as a query filter and once
 * on the row itself. A published-only read is the one thing standing between an
 * unlisted draft and the open internet, so it does not rest on a single clause
 * being written correctly.
 */
async function loadPublished(
  supabase: SupabaseServerClient,
  calendarId: string
): Promise<PublicCalendar | null> {
  const { data } = await supabase
    .from("booking_calendars")
    .select("*")
    .eq("id", calendarId)
    .eq("is_published", true)
    .maybeSingle()

  const calendar = data as BookingCalendarRow | null
  if (!calendar || calendar.is_published !== true) return null

  const [availRes, blackRes, fieldRes, serviceRes] = await Promise.all([
    supabase
      .from("booking_availability")
      .select("*")
      .eq("calendar_id", calendar.id)
      .order("start_minute", { ascending: true }),
    supabase
      .from("booking_blackouts")
      .select("*")
      .eq("calendar_id", calendar.id)
      .order("date", { ascending: true }),
    supabase
      .from("booking_form_fields")
      .select("*")
      .eq("calendar_id", calendar.id)
      .order("position", { ascending: true }),
    supabase
      .from("booking_services")
      .select("*")
      .eq("calendar_id", calendar.id)
      .eq("is_active", true)
      .order("position", { ascending: true }),
  ])

  return {
    calendar,
    availability: (availRes.data as BookingAvailabilityRow[] | null) ?? [],
    blackouts: (blackRes.data as BookingBlackoutRow[] | null) ?? [],
    fields: (fieldRes.data as BookingFormFieldRow[] | null) ?? [],
    services: (serviceRes.data as BookingServiceRow[] | null) ?? [],
  }
}

/**
 * Confirmed bookings around one date. Reaches back a day because a longer
 * booking made yesterday evening can still overlap this morning.
 */
async function takenAround(
  calendar: BookingCalendarRow,
  isoDate: string,
  /** The last of the shop's dates in play, when a viewer's day spans two. */
  throughIsoDate: string = isoDate
): Promise<{ startsAt: string; endsAt: string }[]> {
  const dayStart = zonedTimeToInstant(isoDate, 0, calendar.timezone)
  const dayEnd = zonedTimeToInstant(throughIsoDate, 1440, calendar.timezone)
  return getTakenSlots(
    calendar.id,
    new Date(dayStart.getTime() - 86400_000).toISOString(),
    dayEnd.toISOString()
  )
}

/**
 * Whether a date is one this link will talk about at all — today onwards, in
 * the calendar's own zone, and no further than the horizon.
 */
function withinHorizon(
  isoDate: string,
  timeZone: string,
  horizonDays: number,
  /** The shop's zone, when it differs from the one the date is written in. */
  calendarZone: string = timeZone
): boolean {
  const now = new Date()
  // ISO dates compare correctly as plain strings, which keeps this out of the
  // business of parsing them back into instants.
  const floor = isoDateInZone(
    new Date(now.getTime() - 86400_000),
    calendarZone
  )
  if (isoDate < floor) return false

  // The page is only a UI; nothing stops a script from posting dates straight
  // at the action, so the owner's setting is re-read here rather than trusted
  // from the request.
  const days = Math.min(
    Math.max(1, Math.trunc(horizonDays) || 1),
    ABSOLUTE_MAX_HORIZON_DAYS
  )
  // Day 1 is today, so a 14-day horizon reaches 13 days forward.
  const last = isoDateInZone(
    new Date(now.getTime() + (days - 1) * 86400_000),
    timeZone
  )
  return isoDate <= last
}

/**
 * Why the day came back empty.
 *
 * "Fully booked" and "the day is over" look identical from the slot list, and
 * telling a customer their suki is fully booked when the shop has simply closed
 * for the evening is a small lie that costs a booking. So an open day with
 * nothing on it is rebuilt once more ignoring existing bookings: if times
 * appear, they really were taken; if none do, the notice window ate them.
 */
function emptyReason(
  bundle: PublicCalendar,
  isoDate: string,
  taken: { startsAt: string; endsAt: string }[],
  /** The same rules the empty list was built with. */
  rules: SlotRules
): EmptyReason {
  const { calendar, availability, blackouts } = bundle
  if (blackouts.some((b) => b.date === isoDate)) return "blacked_out"

  const midday = zonedTimeToInstant(isoDate, 12 * 60, calendar.timezone)
  const weekday = weekdayInZone(midday, calendar.timezone)
  const opens = availability.some(
    (a) => a.weekday === weekday && a.end_minute > a.start_minute
  )
  if (!opens) return "closed"
  if (taken.length === 0) return "passed"

  const ignoringBookings = buildSlots({
    isoDate,
    rules,
    availability,
    blackouts,
    taken: [],
  })
  return ignoringBookings.length > 0 ? "full" : "passed"
}

// -----------------------------------------------------------------------------
// getAvailableSlots
// -----------------------------------------------------------------------------

/** The times still on offer for one date, recomputed from the rules each call. */
export async function getAvailableSlots(input: {
  calendarId: string
  /** A date on the VIEWER's calendar, not necessarily the shop's. */
  isoDate: string
  /** The zone that date is written in. Defaults to the calendar's own. */
  viewerZone?: string
  /** Which service is being booked, when the calendar sells a catalogue. */
  serviceId?: string
}): Promise<AvailableSlotsResult> {
  const parsed = SlotsInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, slots: [], message: "That date does not look right." }
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: false, slots: [], message: NO_DB }

  const bundle = await loadPublished(supabase, parsed.data.calendarId)
  if (!bundle) return { ok: false, slots: [], message: NOT_LIVE }

  const calendarZone = bundle.calendar.timezone
  const { isoDate } = parsed.data
  // An unknown zone is not an error worth failing on — it just means we show
  // the shop's own days, which is the honest fallback.
  const viewerZone =
    parsed.data.viewerZone && isKnownTimezone(parsed.data.viewerZone)
      ? parsed.data.viewerZone
      : calendarZone

  if (
    !withinHorizon(
      isoDate,
      viewerZone,
      bundle.calendar.booking_horizon_days,
      calendarZone
    )
  ) {
    return {
      ok: false,
      slots: [],
      timezone: calendarZone,
      message: OUT_OF_RANGE,
    }
  }

  // The viewer's day rarely lines up with the shop's. A Manila shop's Monday
  // is Sunday evening in New York, so a New Yorker's Monday draws slots from
  // two of the shop's dates — build both, then keep only what falls inside the
  // day the viewer actually asked for.
  const window = dayWindowInZone(isoDate, viewerZone)
  const sourceDates = calendarDatesTouching(window, calendarZone)

  const length = resolveService(bundle, parsed.data.serviceId)
  if (!length.ok) {
    return {
      ok: false,
      slots: [],
      timezone: calendarZone,
      message: length.message,
    }
  }

  const rules = rulesOf(bundle.calendar, length.minutes)
  const taken = await takenAround(bundle.calendar, sourceDates[0], sourceDates.at(-1))

  const slots = sourceDates
    .flatMap((date) =>
      buildSlots({
        isoDate: date,
        rules,
        availability: bundle.availability,
        blackouts: bundle.blackouts,
        taken,
      })
    )
    .filter((slot) => withinWindow(slot.startsAt, window))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  return {
    ok: true,
    slots,
    timezone: calendarZone,
    // The reason is asked of the shop's date that contributed most of the
    // window, which is the one a customer would recognise as "that day".
    reason:
      slots.length === 0
        ? emptyReason(bundle, sourceDates[0], taken, rules)
        : undefined,
  }
}

// -----------------------------------------------------------------------------
// submitBooking
// -----------------------------------------------------------------------------

/** Books a slot. Every claim in the payload is re-checked before it is stored. */
export async function submitBooking(
  input: SubmitBookingInput
): Promise<SubmitBookingResult> {
  const parsed = SubmitInput.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      ok: false,
      message: first?.message ?? "Please check the form and try again.",
      fieldErrors:
        first && first.path[0] === "customerName"
          ? { name: first.message }
          : undefined,
    }
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: false, message: NO_DB }

  const bundle = await loadPublished(supabase, parsed.data.calendarId)
  if (!bundle) return { ok: false, message: NOT_LIVE }

  const { calendar, availability, blackouts, fields } = bundle

  // --- what is being booked -------------------------------------------------
  const length = resolveService(bundle, parsed.data.serviceId)
  if (!length.ok) {
    return { ok: false, retry: true, message: length.message }
  }

  // --- the time -------------------------------------------------------------
  const start = new Date(parsed.data.startsAt)
  if (Number.isNaN(start.getTime())) {
    return { ok: false, retry: true, message: "Pakipili po ulit ng oras." }
  }
  const startsAt = start.toISOString()

  // Which day this instant falls on is the calendar's business, not the
  // visitor's — a customer in Dubai must not shift a Manila calendar's date.
  const isoDate = isoDateInZone(start, calendar.timezone)
  if (
    !withinHorizon(isoDate, calendar.timezone, calendar.booking_horizon_days)
  ) {
    return { ok: false, retry: true, message: OUT_OF_RANGE }
  }

  const taken = await takenAround(calendar, isoDate)

  const slots = buildSlots({
    isoDate,
    rules: rulesOf(calendar, length.minutes),
    availability,
    blackouts,
    taken,
  })

  const slot = slots.find((s) => s.startsAt === startsAt)
  if (!slot) {
    return {
      ok: false,
      retry: true,
      message:
        "That time is no longer available. Pakipili po ng iba sa mga natitira.",
    }
  }

  // --- who they are ---------------------------------------------------------
  const fieldErrors: Record<string, string> = {}
  const email = (parsed.data.customerEmail ?? "").trim()
  const phone = (parsed.data.customerPhone ?? "").trim()

  if (!email && !phone) {
    fieldErrors.contact = "Give an email or a mobile number so we can reach you."
  }
  if (email && !EMAIL_RE.test(email)) {
    fieldErrors.contact = "That email does not look right."
  }
  if (phone) {
    const digits = phone.replace(/\D/g, "")
    if (digits.length < 7 || digits.length > 15) {
      fieldErrors.contact = "That mobile number does not look right."
    }
  }

  // --- the questions --------------------------------------------------------
  const submitted = parsed.data.answers ?? {}
  if (Object.keys(submitted).length > MAX_ANSWER_KEYS) {
    return { ok: false, message: "That submission is too large." }
  }

  // Rebuilt from the calendar's own fields, so an answer to a question this
  // calendar never asked cannot ride along into the stored jsonb.
  const answers: Record<string, AnswerValue> = {}
  for (const field of fields) {
    const value = submitted[field.id]
    answers[field.id] = value === undefined ? null : value
  }

  for (const [id, message] of Object.entries(validateAnswers(fields, answers))) {
    fieldErrors[id] = message
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Kulang pa po ang ilang detalye. Please check the marked boxes.",
      fieldErrors,
    }
  }

  // --- write ----------------------------------------------------------------
  //
  // The id is minted here rather than read back. `bookings` has exactly one
  // read policy — the owner's — so a visitor may insert a row but may not
  // select one. Asking PostgREST for the row (`.select()`) would attach a
  // RETURNING clause the anonymous caller is not allowed to read, and the whole
  // booking would fail at the last step. The insert therefore stays write-only.
  const bookingId = crypto.randomUUID()

  const { error } = await supabase.from("bookings").insert({
    id: bookingId,
    calendar_id: calendar.id,
    // Read off the calendar row. An id sent by the caller is never consulted.
    user_id: calendar.user_id,
    starts_at: startsAt,
    ends_at: slot.endsAt,
    customer_name: parsed.data.customerName,
    customer_email: email || null,
    customer_phone: phone || null,
    answers,
    status: "confirmed",
    // The name and price are copied, not merely referenced: renaming or
    // repricing a service next month must not rewrite what this person agreed
    // to, and deleting it must not erase what the booking was for.
    service_id: length.service?.id ?? null,
    service_name: length.service?.name ?? null,
    service_price_centavos: length.service?.price_centavos ?? null,
  })

  if (error) {
    // 23505 is the no-double-booking unique index firing between our slot
    // check and this insert — two people tapping Confirm at the same moment.
    if ((error as { code?: string }).code === "23505") {
      return {
        ok: false,
        retry: true,
        message:
          "Sorry, someone just took that slot. Pakipili po ng ibang oras.",
      }
    }
    return {
      ok: false,
      message: "We could not save that booking. Pakisubukan ulit in a moment.",
    }
  }

  revalidatePath(`/book/${calendar.slug}`)

  return {
    ok: true,
    bookingId,
    message: "Booked! Salamat po — nakalista ka na.",
  }
}

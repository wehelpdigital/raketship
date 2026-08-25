import "server-only"

import { cache } from "react"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import type {
  BookingAvailabilityRow,
  BookingBlackoutRow,
  BookingCalendarRow,
  BookingFormFieldRow,
  BookingRow,
  BookingServiceRow,
} from "@/lib/supabase/types"

export interface CalendarDetail {
  calendar: BookingCalendarRow
  availability: BookingAvailabilityRow[]
  blackouts: BookingBlackoutRow[]
  fields: BookingFormFieldRow[]
  /** Only meaningful when length_mode is 'catalog'. Active ones, in order. */
  services: BookingServiceRow[]
}

export interface CalendarSummary extends BookingCalendarRow {
  availability: Pick<
    BookingAvailabilityRow,
    "weekday" | "start_minute" | "end_minute"
  >[]
  bookingCount: number
  /** Active services. Zero unless this calendar sells a catalogue. */
  serviceCount: number
}

/** Every calendar the user owns, for the module's index. */
export const listCalendars = cache(async function listCalendars(
  userId: string
): Promise<CalendarSummary[]> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return []

  const [calRes, availRes, bookingRes, serviceRes] = await Promise.all([
    supabase
      .from("booking_calendars")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("booking_availability")
      .select("calendar_id, weekday, start_minute, end_minute")
      .eq("user_id", userId),
    supabase
      .from("bookings")
      .select("calendar_id")
      .eq("user_id", userId)
      .eq("status", "confirmed"),
    supabase
      .from("booking_services")
      .select("calendar_id")
      .eq("user_id", userId)
      .eq("is_active", true),
  ])

  const calendars = (calRes.data as BookingCalendarRow[] | null) ?? []
  const availability =
    (availRes.data as (BookingAvailabilityRow & { calendar_id: string })[] | null) ??
    []
  const bookings = (bookingRes.data as { calendar_id: string }[] | null) ?? []
  const services = (serviceRes.data as { calendar_id: string }[] | null) ?? []

  return calendars.map((calendar) => ({
    ...calendar,
    availability: availability
      .filter((a) => a.calendar_id === calendar.id)
      .map(({ weekday, start_minute, end_minute }) => ({
        weekday,
        start_minute,
        end_minute,
      })),
    bookingCount: bookings.filter((b) => b.calendar_id === calendar.id).length,
    serviceCount: services.filter((s) => s.calendar_id === calendar.id).length,
  }))
})

/** One calendar with everything needed to edit it. Owner-scoped. */
export const getCalendar = cache(async function getCalendar(
  userId: string,
  calendarId: string
): Promise<CalendarDetail | null> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null

  const { data: calendar } = await supabase
    .from("booking_calendars")
    .select("*")
    .eq("id", calendarId)
    .eq("user_id", userId)
    .maybeSingle()

  if (!calendar) return null
  return loadChildren(calendar as BookingCalendarRow)
})

/**
 * One calendar by its public slug, for the unauthenticated booking page.
 * RLS already limits anonymous reads to published rows; the explicit filter
 * keeps an owner previewing their own draft from seeing it as live.
 */
export const getPublishedCalendar = cache(
  async function getPublishedCalendar(
    slug: string
  ): Promise<CalendarDetail | null> {
    const supabase = await getSupabaseServerClient()
    if (!supabase) return null

    const { data: calendar } = await supabase
      .from("booking_calendars")
      .select("*")
      .ilike("slug", slug)
      .eq("is_published", true)
      .maybeSingle()

    if (!calendar) return null
    return loadChildren(calendar as BookingCalendarRow)
  }
)

async function loadChildren(
  calendar: BookingCalendarRow
): Promise<CalendarDetail> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return { calendar, availability: [], blackouts: [], fields: [], services: [] }
  }

  const [availRes, blackRes, fieldRes, serviceRes] = await Promise.all([
    supabase
      .from("booking_availability")
      .select("*")
      .eq("calendar_id", calendar.id)
      .order("weekday", { ascending: true })
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
 * Confirmed bookings in a window, used to grey out slots that are gone.
 * Readable anonymously on purpose — the public page needs to know what is
 * taken, so this selects only the times, never the customers' details.
 */
export async function getTakenSlots(
  calendarId: string,
  fromIso: string,
  toIso: string
): Promise<{ startsAt: string; endsAt: string }[]> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return []

  const { data } = await supabase
    .from("bookings")
    .select("starts_at, ends_at")
    .eq("calendar_id", calendarId)
    .eq("status", "confirmed")
    .gte("starts_at", fromIso)
    .lte("starts_at", toIso)

  return ((data as Pick<BookingRow, "starts_at" | "ends_at">[] | null) ?? []).map(
    (b) => ({ startsAt: b.starts_at, endsAt: b.ends_at })
  )
}

/** Upcoming bookings for the owner's dashboard. */
export async function listUpcomingBookings(
  userId: string,
  limit = 20
): Promise<(BookingRow & { calendar: BookingCalendarRow | null })[]> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return []

  const { data } = await supabase
    .from("bookings")
    .select("*, calendar:booking_calendars(*)")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit)

  return (
    (data as (BookingRow & { calendar: BookingCalendarRow | null })[] | null) ??
    []
  )
}

/**
 * How many bookings are still to come.
 *
 * A head count, so the shell pays for a number rather than for every row it
 * is not going to render. "Still to come" is judged on when a booking ENDS,
 * the same way the Booked page splits its lists — otherwise the badge and the
 * page it points at would disagree about the one in progress.
 */
export interface CalendarCounts {
  total: number
  published: number
}

/**
 * How many calendars the owner has, and how many face the public.
 *
 * For the canvas card: two numbers, not the rows — a glance has no use for
 * availability or form fields, and the canvas renders on every visit.
 */
export const countCalendars = cache(async function countCalendars(
  userId: string
): Promise<CalendarCounts> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { total: 0, published: 0 }

  const { data } = await supabase
    .from("booking_calendars")
    .select("is_published")
    .eq("user_id", userId)

  const rows = (data ?? []) as { is_published: boolean }[]
  return {
    total: rows.length,
    published: rows.filter((row) => row.is_published).length,
  }
})

export const countUpcomingBookings = cache(async function countUpcomingBookings(
  userId: string
): Promise<number> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return 0

  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gte("ends_at", new Date().toISOString())

  return count ?? 0
})

export interface OwnerBooking extends BookingRow {
  calendar: BookingCalendarRow | null
}

export interface BookedList {
  /** Confirmed and still to come, soonest first — the working list. */
  upcoming: OwnerBooking[]
  /** Confirmed but already happened, most recent first. */
  past: OwnerBooking[]
  /** Cancelled, whenever they were. Their slots went back on sale. */
  cancelled: OwnerBooking[]
  /** The questions each calendar asked, so stored answers can be labelled. */
  fieldsByCalendar: Record<string, BookingFormFieldRow[]>
}

/**
 * Everything that came in through the public booking pages.
 *
 * One read for the lot, then split in memory: the three groups are the same
 * rows asked three different questions, and three round trips to answer them
 * would be three chances for them to disagree about where "now" is.
 *
 * The answers are stored keyed by field id, which means nothing without the
 * questions — so those come along, grouped by calendar.
 */
export async function listBookedForOwner(
  userId: string,
  limit = 500
): Promise<BookedList> {
  const empty: BookedList = {
    upcoming: [],
    past: [],
    cancelled: [],
    fieldsByCalendar: {},
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) return empty

  const [bookingRes, fieldRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, calendar:booking_calendars(*)")
      .eq("user_id", userId)
      .order("starts_at", { ascending: false })
      .limit(limit),
    supabase
      .from("booking_form_fields")
      .select("*")
      .eq("user_id", userId)
      .order("position", { ascending: true }),
  ])

  const rows = (bookingRes.data as OwnerBooking[] | null) ?? []
  const fields = (fieldRes.data as BookingFormFieldRow[] | null) ?? []

  const fieldsByCalendar: Record<string, BookingFormFieldRow[]> = {}
  for (const field of fields) {
    ;(fieldsByCalendar[field.calendar_id] ??= []).push(field)
  }

  // One clock for the whole split. Reading the time per row would let a
  // booking starting this second land in both lists or neither.
  const now = Date.now()

  const upcoming: OwnerBooking[] = []
  const past: OwnerBooking[] = []
  const cancelled: OwnerBooking[] = []

  for (const row of rows) {
    if (row.status !== "confirmed") {
      cancelled.push(row)
      continue
    }
    // Judged on when it ENDS: a booking in progress is still today's problem,
    // not history.
    if (new Date(row.ends_at).getTime() >= now) upcoming.push(row)
    else past.push(row)
  }

  // The query sorted newest first, which is right for what is over and wrong
  // for what is coming.
  upcoming.reverse()

  return { upcoming, past, cancelled, fieldsByCalendar }
}

/** Slugs the user already holds, so the editor can suggest a free one. */
export async function listOwnedSlugs(userId: string): Promise<string[]> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return []
  const { data } = await supabase
    .from("booking_calendars")
    .select("slug")
    .eq("user_id", userId)
  return ((data as { slug: string }[] | null) ?? []).map((r) => r.slug)
}

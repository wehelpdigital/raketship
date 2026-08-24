import "server-only"

import { cache } from "react"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import type {
  BookingAvailabilityRow,
  BookingBlackoutRow,
  BookingCalendarRow,
  BookingFormFieldRow,
  BookingRow,
} from "@/lib/supabase/types"

export interface CalendarDetail {
  calendar: BookingCalendarRow
  availability: BookingAvailabilityRow[]
  blackouts: BookingBlackoutRow[]
  fields: BookingFormFieldRow[]
}

export interface CalendarSummary extends BookingCalendarRow {
  availability: Pick<
    BookingAvailabilityRow,
    "weekday" | "start_minute" | "end_minute"
  >[]
  bookingCount: number
}

/** Every calendar the user owns, for the module's index. */
export const listCalendars = cache(async function listCalendars(
  userId: string
): Promise<CalendarSummary[]> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return []

  const [calRes, availRes, bookingRes] = await Promise.all([
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
  ])

  const calendars = (calRes.data as BookingCalendarRow[] | null) ?? []
  const availability =
    (availRes.data as (BookingAvailabilityRow & { calendar_id: string })[] | null) ??
    []
  const bookings = (bookingRes.data as { calendar_id: string }[] | null) ?? []

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
    return { calendar, availability: [], blackouts: [], fields: [] }
  }

  const [availRes, blackRes, fieldRes] = await Promise.all([
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
  ])

  return {
    calendar,
    availability: (availRes.data as BookingAvailabilityRow[] | null) ?? [],
    blackouts: (blackRes.data as BookingBlackoutRow[] | null) ?? [],
    fields: (fieldRes.data as BookingFormFieldRow[] | null) ?? [],
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

/**
 * Turning availability rules into bookable slots.
 *
 * All of it is pure: given rules, blackouts and existing bookings, produce the
 * times a customer may pick. No Supabase import, so it stays cheap to test.
 *
 * Timezones are the whole difficulty here. A calendar's hours are expressed in
 * ITS timezone ("Tuesdays 9am-5pm in Asia/Manila"), while bookings are stored
 * as absolute instants. The conversion runs through Intl rather than a date
 * library so there is no dependency to keep current with tzdata.
 */

import type {
  BookingAvailabilityRow,
  BookingBlackoutRow,
} from "@/lib/supabase/types"

export interface Slot {
  /** Absolute instant, ISO 8601. */
  startsAt: string
  endsAt: string
  /** "09:30" as the customer sees it, in the calendar's timezone. */
  label: string
}

export interface SlotRules {
  timezone: string
  durationMinutes: number
  bufferMinutes: number
  noticeHours: number
}

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

/**
 * Intl.DateTimeFormat is expensive to construct and cheap to reuse — measured
 * at roughly 12x on a year of slots, which is the difference between a page
 * that renders and one that stalls. Formatters are immutable, so caching them
 * per zone is safe.
 */
const FORMATTERS = new Map<string, Intl.DateTimeFormat>()

function formatter(
  key: string,
  build: () => Intl.DateTimeFormat
): Intl.DateTimeFormat {
  const cached = FORMATTERS.get(key)
  if (cached) return cached
  const made = build()
  FORMATTERS.set(key, made)
  return made
}

/** "09:30" from 570. */
export function minutesToTime(minutes: number): string {
  const safe = Math.max(0, Math.min(1440, Math.round(minutes)))
  const h = Math.floor(safe / 60)
  const m = safe % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** 570 from "09:30". Returns null when it is not a time. */
export function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h < 0 || h > 24 || m < 0 || m > 59) return null
  const total = h * 60 + m
  return total > 1440 ? null : total
}

/** "9:30 AM" for display. */
export function formatTimeLabel(minutes: number): string {
  const safe = Math.max(0, Math.min(1439, Math.round(minutes)))
  const h24 = Math.floor(safe / 60)
  const m = safe % 60
  const suffix = h24 < 12 ? "AM" : "PM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`
}

/** "2026-08-24" for a Date, in the given timezone. */
export function isoDateInZone(date: Date, timeZone: string): string {
  // "en-CA" formats as YYYY-MM-DD, which saves reassembling parts by hand.
  try {
    return formatter(`date:${timeZone}`, () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    ).format(date)
  } catch {
    return formatter("date:", () =>
      new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    ).format(date)
  }
}

/** Weekday (0 = Sunday) of an instant, as seen in the given timezone. */
export function weekdayInZone(date: Date, timeZone: string): number {
  let name: string
  try {
    name = formatter(`weekday:${timeZone}`, () =>
      new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" })
    ).format(date)
  } catch {
    name = formatter("weekday:", () =>
      new Intl.DateTimeFormat("en-US", { weekday: "short" })
    ).format(date)
  }
  const index = WEEKDAY_SHORT.indexOf(name as (typeof WEEKDAY_SHORT)[number])
  return index === -1 ? date.getUTCDay() : index
}

/**
 * How far the zone sits from UTC at a given instant, in minutes.
 * Derived by formatting the instant as if it were UTC and diffing — which
 * handles daylight saving without a tzdata table of our own.
 */
export function zoneOffsetMinutes(date: Date, timeZone: string): number {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = formatter(`offset:${timeZone}`, () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    ).formatToParts(date)
  } catch {
    return 0
  }

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0")

  // Intl renders hour 24 for midnight under hour12:false in some engines.
  const hour = get("hour") % 24

  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second")
  )
  return Math.round((asUtc - date.getTime()) / 60000)
}

/**
 * The instant at which a wall-clock time occurs in a zone.
 *
 * The offset depends on the instant we are solving for, so this reads the
 * offset once, applies it, then re-reads and corrects — enough to land on the
 * right side of a daylight-saving change.
 */
export function zonedTimeToInstant(
  isoDate: string,
  minutes: number,
  timeZone: string
): Date {
  const [y, m, d] = isoDate.split("-").map(Number)
  const naive = Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, minutes, 0)

  let guess = new Date(naive - zoneOffsetMinutes(new Date(naive), timeZone) * 60000)
  const offset = zoneOffsetMinutes(guess, timeZone)
  guess = new Date(naive - offset * 60000)
  return guess
}

export interface BuildSlotsInput {
  isoDate: string
  rules: SlotRules
  availability: Pick<
    BookingAvailabilityRow,
    "weekday" | "start_minute" | "end_minute"
  >[]
  blackouts: Pick<BookingBlackoutRow, "date">[]
  /** Confirmed bookings that already occupy time on this calendar. */
  taken: { startsAt: string; endsAt: string }[]
  /** Injected so tests are deterministic. */
  now?: Date
}

/**
 * Bookable slots for one date. Empty when the day is blacked out, has no
 * weekly rule, or everything is already taken or inside the notice window.
 */
export function buildSlots({
  isoDate,
  rules,
  availability,
  blackouts,
  taken,
  now = new Date(),
}: BuildSlotsInput): Slot[] {
  const { timezone, durationMinutes, bufferMinutes, noticeHours } = rules

  if (durationMinutes <= 0) return []
  if (blackouts.some((b) => b.date === isoDate)) return []

  // The weekday of this date as the calendar's own timezone sees it. Midday
  // avoids any chance of a midnight offset flipping the day.
  const midday = zonedTimeToInstant(isoDate, 12 * 60, timezone)
  const weekday = weekdayInZone(midday, timezone)

  const windows = availability
    .filter((a) => a.weekday === weekday && a.end_minute > a.start_minute)
    .sort((a, b) => a.start_minute - b.start_minute)
  if (windows.length === 0) return []

  const earliest = now.getTime() + noticeHours * 3600_000
  const step = durationMinutes + Math.max(0, bufferMinutes)

  const busy = taken.map((t) => ({
    start: new Date(t.startsAt).getTime(),
    end: new Date(t.endsAt).getTime(),
  }))

  const slots: Slot[] = []
  const seen = new Set<string>()

  for (const window of windows) {
    for (
      let minute = window.start_minute;
      minute + durationMinutes <= window.end_minute;
      minute += step
    ) {
      const start = zonedTimeToInstant(isoDate, minute, timezone)
      const startMs = start.getTime()
      const endMs = startMs + durationMinutes * 60000

      if (startMs < earliest) continue
      // Overlap, not just equality — a longer booking can straddle a slot.
      if (busy.some((b) => startMs < b.end && endMs > b.start)) continue

      const startsAt = new Date(startMs).toISOString()
      if (seen.has(startsAt)) continue
      seen.add(startsAt)

      slots.push({
        startsAt,
        endsAt: new Date(endMs).toISOString(),
        label: formatTimeLabel(minute),
      })
    }
  }

  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

/** The next `count` dates from `from`, as ISO strings in the zone. */
export function upcomingDates(
  from: Date,
  count: number,
  timeZone: string
): string[] {
  const dates: string[] = []
  for (let i = 0; i < count; i++) {
    dates.push(
      isoDateInZone(new Date(from.getTime() + i * 86400_000), timeZone)
    )
  }
  return dates
}

export interface ZonedInstant {
  /** "9:00 AM" as that zone reads it. */
  time: string
  /** "2026-09-07" in that zone — which is not always the calendar's date. */
  isoDate: string
}

/**
 * An absolute instant as a given zone sees it.
 *
 * A slot stores the instant, so this conversion is exact. What it cannot hide
 * is that a 9am Manila slot is the previous evening in New York — hence the
 * date coming back alongside the time, so a caller can say so when it differs
 * rather than quietly showing someone the wrong day.
 */
export function instantInZone(iso: string, timeZone: string): ZonedInstant {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return { time: "", isoDate: "" }

  const isoDate = isoDateInZone(at, timeZone)
  let minutes = 0
  try {
    const parts = formatter(`hm:${timeZone}`, () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      })
    ).formatToParts(at)
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? "0")
    minutes = (get("hour") % 24) * 60 + get("minute")
  } catch {
    return { time: "", isoDate }
  }

  return { time: formatTimeLabel(minutes), isoDate }
}

export interface DayWindow {
  /** Midnight opening the day, in that zone. */
  start: Date
  /** Midnight opening the NEXT day — the exclusive end. */
  end: Date
}

/** The instants a given calendar day spans, as one zone experiences it. */
export function dayWindowInZone(isoDate: string, timeZone: string): DayWindow {
  return {
    start: zonedTimeToInstant(isoDate, 0, timeZone),
    end: zonedTimeToInstant(isoDate, 1440, timeZone),
  }
}

/**
 * Which of the calendar's own dates a viewer's day touches.
 *
 * This is the crux of showing a shop's hours to someone in another country.
 * A Manila shop's Monday is Sunday evening in New York, so a New Yorker's
 * "Monday" draws slots from the shop's Monday AND Tuesday. Offsets reach ±14
 * hours, and a day is 24 long, so a window can only ever touch two or three
 * of the calendar's dates — but it is never reliably just one.
 */
export function calendarDatesTouching(
  window: DayWindow,
  calendarZone: string
): string[] {
  const dates: string[] = []
  const first = isoDateInZone(window.start, calendarZone)
  // One millisecond inside the end, so a window that stops exactly at midnight
  // does not claim the day it never actually reaches.
  const last = isoDateInZone(new Date(window.end.getTime() - 1), calendarZone)

  dates.push(first)
  if (last !== first) {
    // Walk day by day rather than assuming exactly two: a large offset swing
    // can put a third date in between.
    let cursor = new Date(window.start.getTime())
    for (let i = 0; i < 4; i++) {
      cursor = new Date(cursor.getTime() + 86400_000)
      if (cursor.getTime() >= window.end.getTime()) break
      const middle = isoDateInZone(cursor, calendarZone)
      if (!dates.includes(middle)) dates.push(middle)
    }
    if (!dates.includes(last)) dates.push(last)
  }
  return dates
}

/** Whether an instant falls inside a day window. */
export function withinWindow(iso: string, window: DayWindow): boolean {
  const at = new Date(iso).getTime()
  return at >= window.start.getTime() && at < window.end.getTime()
}

export interface DayHours {
  /** 0 = Sunday. */
  weekday: number
  /** "Mon" */
  short: string
  /** "Monday" */
  long: string
  /** ["9:00 AM – 12:00 PM", "1:00 PM – 5:00 PM"], earliest first. */
  ranges: string[]
}

/**
 * All seven days, each with its own hours.
 *
 * summariseAvailability() joins everything into one line, which is right for a
 * card but unreadable as a schedule — a full week becomes a run-on string of
 * days and times. This keeps the days apart so they can be laid out as rows.
 * Closed days are included so the week always reads as seven rows.
 */
export function groupAvailabilityByDay(
  availability: Pick<
    BookingAvailabilityRow,
    "weekday" | "start_minute" | "end_minute"
  >[]
): DayHours[] {
  return WEEKDAY_LABELS.map((long, weekday) => ({
    weekday,
    short: WEEKDAY_SHORT[weekday],
    long,
    ranges: availability
      .filter((a) => a.weekday === weekday && a.end_minute > a.start_minute)
      .sort((a, b) => a.start_minute - b.start_minute)
      .map(
        (a) =>
          `${formatTimeLabel(a.start_minute)} – ${formatTimeLabel(a.end_minute)}`
      ),
  }))
}

/** Weekday rules collapsed to one readable line per day. */
export function summariseAvailability(
  availability: Pick<
    BookingAvailabilityRow,
    "weekday" | "start_minute" | "end_minute"
  >[]
): string {
  if (availability.length === 0) return "No days set yet"

  const byDay = new Map<number, string[]>()
  for (const a of [...availability].sort(
    (x, y) => x.weekday - y.weekday || x.start_minute - y.start_minute
  )) {
    const list = byDay.get(a.weekday) ?? []
    list.push(`${formatTimeLabel(a.start_minute)}–${formatTimeLabel(a.end_minute)}`)
    byDay.set(a.weekday, list)
  }

  return [...byDay.entries()]
    .map(([day, ranges]) => `${WEEKDAY_SHORT[day]} ${ranges.join(", ")}`)
    .join(" · ")
}

// -----------------------------------------------------------------------------
// Lengths
// -----------------------------------------------------------------------------

/** Minutes chosen in ten-minute steps, which is how people describe a job. */
export const MINUTE_STEPS = [0, 10, 20, 30, 40, 50] as const

/** Hours a single appointment can plausibly run to. */
export const HOUR_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const

/** The shortest and longest the database will accept, mirrored here. */
export const MIN_DURATION = 5
export const MAX_DURATION = 480

export interface HoursAndMinutes {
  hours: number
  minutes: number
}

export function splitDuration(totalMinutes: number): HoursAndMinutes {
  const safe = Math.max(0, Math.round(totalMinutes))
  return { hours: Math.floor(safe / 60), minutes: safe % 60 }
}

export function joinDuration({ hours, minutes }: HoursAndMinutes): number {
  return Math.max(0, hours) * 60 + Math.max(0, minutes)
}

/**
 * "1 hr 30 min", "45 min", "2 hrs".
 *
 * Written out rather than "1:30" because a length is not a time of day, and
 * the two are easy to confuse on a page full of clock times.
 */
export function formatDuration(totalMinutes: number): string {
  const { hours, minutes } = splitDuration(totalMinutes)
  if (hours === 0 && minutes === 0) return "0 min"
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hr" : "hrs"}`)
  if (minutes > 0) parts.push(`${minutes} min`)
  return parts.join(" ")
}

/** Returns an error message, or null when the length is usable. */
export function validateDuration(totalMinutes: number): string | null {
  if (!Number.isFinite(totalMinutes) || !Number.isInteger(totalMinutes)) {
    return "Pick a length."
  }
  if (totalMinutes < MIN_DURATION) {
    return `A booking has to be at least ${MIN_DURATION} minutes.`
  }
  if (totalMinutes > MAX_DURATION) {
    return "A booking can be at most 8 hours."
  }
  return null
}

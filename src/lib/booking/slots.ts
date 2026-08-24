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

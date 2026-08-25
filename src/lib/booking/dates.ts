import { WEEKDAY_LABELS, WEEKDAY_SHORT } from "@/lib/booking/slots"
import { t, type Locale } from "@/lib/i18n"
import { tagalogCount } from "@/lib/i18n/numbers"

/**
 * Dates written out from their parts, never through the viewer's locale.
 *
 * A server render and a hydrated render have to agree character for character,
 * and Intl does not promise that across a locale the visitor picked and the
 * server never saw. Building the string from the numbers removes the question.
 *
 * Shared by the public wizard and the owner's booked list, so those two cannot
 * end up describing the same day differently.
 */

export const MONTHS = [
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

export function partsOf(iso: string): {
  year: number
  month: number
  day: number
} {
  const [year, month, day] = iso.split("-").map(Number)
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 }
}

/** 0 = Sunday. The ISO date is already the local date, so UTC is safe here. */
export function weekdayOfIso(iso: string): number {
  const { year, month, day } = partsOf(iso)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** "Sat 6 Sep", for flagging a slot that lands on another day. */
export function shortDate(iso: string): string {
  const { month, day } = partsOf(iso)
  return `${WEEKDAY_SHORT[weekdayOfIso(iso)]} ${day} ${MONTHS[month - 1].slice(0, 3)}`
}

/** "Monday, 1 March". */
export function longDate(iso: string): string {
  const { month, day } = partsOf(iso)
  return `${WEEKDAY_LABELS[weekdayOfIso(iso)]}, ${day} ${MONTHS[month - 1]}`
}

/** "1 March 2026", for a date far enough away that the year matters. */
export function longDateWithYear(iso: string): string {
  const { year, month, day } = partsOf(iso)
  return `${WEEKDAY_LABELS[weekdayOfIso(iso)]}, ${day} ${MONTHS[month - 1]} ${year}`
}

/** Whole days from one ISO date to another. Negative when `to` is earlier. */
export function dayOffset(fromIso: string, toIso: string): number {
  const day = (iso: string) => {
    const { year, month, day: d } = partsOf(iso)
    return Date.UTC(year, month - 1, d)
  }
  return Math.round((day(toIso) - day(fromIso)) / 86_400_000)
}

/**
 * How far out a relative label stays useful.
 *
 * Past a month "Sa 96 araw" is a number nobody counts in; the written date
 * beside it says the same thing better. Inside a month it is the fastest read
 * on the page.
 */
export const RELATIVE_DAY_LIMIT = 30

/**
 * "Bukas", "Sa loob ng limang araw", "Tomorrow", "In 5 days" — or null when
 * the day is far enough away that counting it serves nobody.
 *
 * A booking list is read relative to today far more often than absolutely: an
 * owner wants to know what is happening now, not to parse a date. This is the
 * relative half only — it is meant to sit BESIDE the written date, never
 * instead of it, so that "Bukas" never leaves someone wondering which day that
 * actually is.
 *
 * The two languages do not have the same shape here and are not made to. The
 * Filipino counted form spells the number out and wraps it — "sa loob ng
 * tatlong araw" — because that is how it is said; English keeps the digits.
 * Both parameters are handed to both, and each message uses the one it wants.
 */
export function relativeDayLabel(
  iso: string,
  todayIso: string,
  locale: Locale
): string | null {
  const offset = dayOffset(todayIso, iso)
  if (Math.abs(offset) > RELATIVE_DAY_LIMIT) return null

  switch (offset) {
    case 0:
      return t(locale, "date.today")
    case 1:
      return t(locale, "date.tomorrow")
    case 2:
      return t(locale, "date.dayAfter")
    case -1:
      return t(locale, "date.yesterday")
    default: {
      const days = Math.abs(offset)
      const params = { n: days, count: tagalogCount(days) }
      return offset > 0
        ? t(locale, "date.inDays", params)
        : t(locale, "date.daysAgo", params)
    }
  }
}

/**
 * How much attention a day deserves, for colour.
 *
 * Three bands, not a gradient: a colour that means "slightly more urgent than
 * the one above it" means nothing at a glance. "now" is the window an owner
 * cannot let slip — today and tomorrow. "soon" is the rest of the week, which
 * wants preparing for. Everything else, in either direction, is quiet.
 *
 * The past is never urgent. A booking that already happened cannot be missed,
 * and painting last Tuesday red would make the one colour that means "act"
 * mean nothing.
 */
export type DayUrgency = "now" | "soon" | "later"

export function dayUrgency(iso: string, todayIso: string): DayUrgency {
  const offset = dayOffset(todayIso, iso)
  if (offset < 0) return "later"
  if (offset <= 1) return "now"
  if (offset <= 6) return "soon"
  return "later"
}

import { WEEKDAY_LABELS, WEEKDAY_SHORT } from "@/lib/booking/slots"

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

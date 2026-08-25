/**
 * Finding one booking among many.
 *
 * Pure, so the searching can be tested without rendering anything — and so the
 * list component stays about layout rather than about matching.
 */

export interface SearchableBooking {
  id: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  calendarName: string
  serviceName: string | null
  /** The stored answers, already flattened to text. */
  answerText: string
}

/**
 * How many rows are on screen before scrolling asks for more, and how many
 * more it asks for.
 *
 * The first number is a screenful and a bit on a phone; the second is enough
 * that a fast scroll does not out-run it. Both are here rather than in the
 * component so the reasoning sits with the rest of the list's arithmetic.
 */
export const INITIAL_VISIBLE = 20
export const VISIBLE_STEP = 20

/**
 * The reference a customer would quote, taken off the id.
 *
 * Shown on the confirmation as the first eight characters, uppercased, so
 * searching has to match what they were given rather than the whole uuid.
 */
export function referenceOf(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

/**
 * Everything about a booking that is worth typing into a search box.
 *
 * Digits are kept alongside the formatted number so "0917 123" finds a row
 * stored as "09171234567" — people search phone numbers the way they say them.
 */
export function searchHaystack(row: SearchableBooking): string {
  const phone = row.customerPhone ?? ""
  return [
    row.customerName,
    row.customerEmail ?? "",
    phone,
    phone.replace(/\D/g, ""),
    row.calendarName,
    row.serviceName ?? "",
    row.answerText,
    referenceOf(row.id),
  ]
    .join(" ")
    .toLowerCase()
}

/**
 * Whether a row matches what was typed.
 *
 * Every word must appear somewhere, so a second word narrows rather than
 * widens — typing more should never give you more.
 */
export function matchesQuery(row: SearchableBooking, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = searchHaystack(row)
  return q.split(/\s+/).every((word) => haystack.includes(word))
}

/**
 * How many rows to show after the list has been scrolled to the end of what is
 * already there.
 *
 * Never past the end, and never backwards: a filter that shrinks the list
 * underneath a scroll position should not also throw away rows that are
 * already on screen and being read.
 */
export function grow(visible: number, total: number, step = VISIBLE_STEP): number {
  const wanted = Math.max(INITIAL_VISIBLE, Math.trunc(visible)) + Math.max(1, step)
  return Math.min(wanted, Math.max(0, total))
}

/** Whether anything is still waiting below the fold. */
export function hasMore(visible: number, total: number): boolean {
  return visible < total
}

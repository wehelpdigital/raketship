/**
 * Finding one booking among many.
 *
 * Pure, so the searching and paging can be tested without rendering anything —
 * and so the list component stays about layout rather than about matching.
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

/** How many rows a page holds. */
export const PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 10

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

/** How many pages a list of this length needs. Always at least one. */
export function pageCount(total: number, size: number): number {
  if (!Number.isFinite(size) || size <= 0) return 1
  return Math.max(1, Math.ceil(Math.max(0, total) / size))
}

/**
 * Brings a page number into range for a list of this length.
 *
 * Filtering can shrink a list under the page somebody is on, and a page past
 * the end renders as empty — which reads as "no results" when there are
 * plenty, just not there.
 */
export function clampPage(page: number, total: number, size: number): number {
  const last = pageCount(total, size)
  if (!Number.isFinite(page)) return 1
  return Math.min(Math.max(1, Math.trunc(page)), last)
}

/** The slice of items for one page. */
export function paginate<T>(items: readonly T[], page: number, size: number): T[] {
  if (!Number.isFinite(size) || size <= 0) return [...items]
  const current = clampPage(page, items.length, size)
  const start = (current - 1) * size
  return items.slice(start, start + size)
}

/**
 * The page numbers to offer, with gaps where there are too many to list.
 *
 * Returns numbers and nulls, a null standing for an elided run. Always shows
 * the first and last page, so however long the list is there is a way to reach
 * either end in one tap.
 */
export function pageWindow(
  current: number,
  total: number,
  span = 1
): (number | null)[] {
  if (total <= 1) return [1]

  const page = clampPage(current, total * span || total, 1)
  const wanted = new Set<number>([1, total])
  for (let p = page - span; p <= page + span; p++) {
    if (p >= 1 && p <= total) wanted.add(p)
  }

  const pages = [...wanted].sort((a, b) => a - b)
  const out: (number | null)[] = []
  let previous: number | null = null

  for (const p of pages) {
    if (previous !== null) {
      const skipped = p - previous - 1
      // A gap hiding exactly one page is worse than the page: it costs the
      // same width and takes away somewhere to tap.
      if (skipped === 1) out.push(previous + 1)
      else if (skipped > 1) out.push(null)
    }
    out.push(p)
    previous = p
  }
  return out
}

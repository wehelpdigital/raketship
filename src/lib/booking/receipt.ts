/**
 * The booking receipt a suki can keep.
 *
 * A screenshot works, but it captures whatever else was on screen and it
 * depends on knowing the gesture. Drawing the thing ourselves gives a picture
 * that is only the booking, sized for a chat app, in the shop's own colour.
 *
 * The parts here are pure so they can be tested. The drawing itself needs a
 * canvas and lives with the component.
 */

export interface ReceiptRow {
  label: string
  value: string
  /** Shown smaller under the value. */
  note?: string
}

export interface ReceiptData {
  businessName: string
  headline: string
  rows: ReceiptRow[]
  reference: string | null
}

/**
 * "booking-9F8E7D6C.png", or the date when there is no reference.
 *
 * Named for something the customer can match against a message rather than a
 * timestamp nobody can read.
 */
export function receiptFileName(
  reference: string | null,
  isoDate: string
): string {
  const safe = (reference ?? isoDate).replace(/[^A-Za-z0-9-]/g, "")
  return `booking-${safe || "raketship"}.png`
}

/**
 * Breaks a line to fit a width, using whatever measurer the caller has.
 *
 * Takes a measure function rather than a canvas so the wrapping can be tested
 * without one — jsdom has no 2D context, and this is the part with the edge
 * cases in it.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (line: string) => number
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const lines: string[] = []
  let line = words[0]

  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`
    if (measure(candidate) <= maxWidth) {
      line = candidate
      continue
    }
    lines.push(line)
    line = word
  }
  lines.push(line)
  return lines
}

/**
 * Shortens to fit, with an ellipsis, when even one word will not.
 *
 * A name long enough to overflow is rare, and a receipt with a word running
 * off the edge looks broken in a way a trimmed one does not.
 */
export function truncateToWidth(
  text: string,
  maxWidth: number,
  measure: (line: string) => number
): string {
  if (measure(text) <= maxWidth) return text

  let cut = text
  while (cut.length > 1 && measure(`${cut}…`) > maxWidth) {
    cut = cut.slice(0, -1)
  }
  return `${cut.trimEnd()}…`
}

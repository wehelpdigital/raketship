import { describe, expect, it } from "vitest"

import { receiptFileName, truncateToWidth, wrapText } from "./receipt"

/** Every character one unit wide, so the sums are obvious. */
const measure = (line: string) => line.length

describe("receiptFileName", () => {
  it("names it after the reference, which is what a message will quote", () => {
    expect(receiptFileName("9F8E7D6C", "2026-09-07")).toBe("booking-9F8E7D6C.png")
  })

  it("falls back to the date when there is no reference", () => {
    expect(receiptFileName(null, "2026-09-07")).toBe("booking-2026-09-07.png")
  })

  it("strips anything a filesystem would object to", () => {
    expect(receiptFileName("../../etc/passwd", "x")).toBe("booking-etcpasswd.png")
    expect(receiptFileName("a b:c*d?", "x")).toBe("booking-abcd.png")
  })

  it("still produces a name when everything was stripped", () => {
    expect(receiptFileName("///", "***")).toBe("booking-raketship.png")
  })
})

describe("wrapText", () => {
  it("keeps a line that already fits", () => {
    expect(wrapText("Gupit ni Nena", 20, measure)).toEqual(["Gupit ni Nena"])
  })

  it("breaks on words, not mid-word", () => {
    expect(wrapText("Gupit at kulay sa Marikina", 12, measure)).toEqual([
      "Gupit at",
      "kulay sa",
      "Marikina",
    ])
  })

  it("gives a too-long word its own line rather than losing it", () => {
    // Better an overflowing line than a silently dropped word.
    expect(wrapText("short pneumonoultramicroscopic end", 8, measure)).toEqual([
      "short",
      "pneumonoultramicroscopic",
      "end",
    ])
  })

  it("collapses the whitespace people actually type", () => {
    expect(wrapText("  Gupit   ni   Nena  ", 100, measure)).toEqual([
      "Gupit ni Nena",
    ])
  })

  it("returns nothing for nothing", () => {
    expect(wrapText("", 100, measure)).toEqual([])
    expect(wrapText("   ", 100, measure)).toEqual([])
  })
})

describe("truncateToWidth", () => {
  it("leaves what already fits alone", () => {
    expect(truncateToWidth("Gupit", 10, measure)).toBe("Gupit")
  })

  it("trims and marks what does not", () => {
    const result = truncateToWidth("Gupit ni Aling Nena", 10, measure)
    expect(result.endsWith("…")).toBe(true)
    expect(measure(result)).toBeLessThanOrEqual(10)
  })

  it("does not leave a space stranded before the ellipsis", () => {
    expect(truncateToWidth("Gupit ni Nena", 7, measure)).not.toContain(" …")
  })

  it("gives up gracefully on an impossible width", () => {
    // Never loops forever, and never returns an empty string.
    const result = truncateToWidth("Gupit", 0, measure)
    expect(result.length).toBeGreaterThan(0)
  })
})

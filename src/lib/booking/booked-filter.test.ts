import { describe, expect, it } from "vitest"

import {
  clampPage,
  matchesQuery,
  pageCount,
  pageWindow,
  paginate,
  referenceOf,
  searchHaystack,
  type SearchableBooking,
} from "./booked-filter"

function row(overrides: Partial<SearchableBooking> = {}): SearchableBooking {
  return {
    id: "9f8e7d6c-1111-4222-8333-444444444444",
    customerName: "Juan dela Cruz",
    customerEmail: "juan@example.com",
    customerPhone: "09171234567",
    calendarName: "Gupit ni Nena",
    serviceName: "Gupit at kulay",
    answerText: "Fade po",
    ...overrides,
  }
}

describe("referenceOf", () => {
  it("is what the customer was shown on their confirmation", () => {
    expect(referenceOf("9f8e7d6c-1111-4222-8333-444444444444")).toBe("9F8E7D6C")
  })
})

describe("matchesQuery", () => {
  it("matches nothing typed as everything", () => {
    expect(matchesQuery(row(), "")).toBe(true)
    expect(matchesQuery(row(), "   ")).toBe(true)
  })

  it("finds a booking by the things an owner would remember", () => {
    for (const query of [
      "juan",
      "dela cruz",
      "JUAN",
      "juan@example.com",
      "gupit",
      "kulay",
      "fade",
      "9F8E7D6C",
      "9f8e7d6c",
    ]) {
      expect(matchesQuery(row(), query), query).toBe(true)
    }
  })

  it("finds a phone number typed the way people say it", () => {
    // Stored as 09171234567; nobody types it back without spaces.
    expect(matchesQuery(row(), "0917 123 4567")).toBe(true)
    expect(matchesQuery(row(), "0917-123")).toBe(false)
    expect(matchesQuery(row(), "09171234567")).toBe(true)
  })

  it("narrows on a second word rather than widening", () => {
    // Typing more must never return more.
    expect(matchesQuery(row(), "juan gupit")).toBe(true)
    expect(matchesQuery(row(), "juan tokyo")).toBe(false)
  })

  it("says no when it should", () => {
    expect(matchesQuery(row(), "maria")).toBe(false)
    expect(matchesQuery(row(), "zzzz")).toBe(false)
  })

  it("survives a row with almost nothing on it", () => {
    const bare = row({
      customerEmail: null,
      customerPhone: null,
      serviceName: null,
      answerText: "",
    })
    expect(() => matchesQuery(bare, "juan")).not.toThrow()
    expect(matchesQuery(bare, "juan")).toBe(true)
    expect(matchesQuery(bare, "kulay")).toBe(false)
  })
})

describe("searchHaystack", () => {
  it("is lowercase, so the query only has to be", () => {
    expect(searchHaystack(row())).toBe(searchHaystack(row()).toLowerCase())
  })

  it("carries the reference, not the whole uuid", () => {
    const hay = searchHaystack(row())
    expect(hay).toContain("9f8e7d6c")
    expect(hay).not.toContain("444444444444")
  })
})

describe("pageCount", () => {
  it("counts the pages a list needs", () => {
    expect(pageCount(0, 10)).toBe(1)
    expect(pageCount(1, 10)).toBe(1)
    expect(pageCount(10, 10)).toBe(1)
    expect(pageCount(11, 10)).toBe(2)
    expect(pageCount(25, 10)).toBe(3)
  })

  it("never returns zero, so there is always a page to be on", () => {
    expect(pageCount(0, 10)).toBe(1)
    expect(pageCount(-5, 10)).toBe(1)
  })

  it("survives a nonsense page size", () => {
    expect(pageCount(50, 0)).toBe(1)
    expect(pageCount(50, Number.NaN)).toBe(1)
  })
})

describe("clampPage", () => {
  it("holds a page inside the list", () => {
    expect(clampPage(1, 25, 10)).toBe(1)
    expect(clampPage(3, 25, 10)).toBe(3)
    expect(clampPage(9, 25, 10)).toBe(3)
    expect(clampPage(0, 25, 10)).toBe(1)
    expect(clampPage(-4, 25, 10)).toBe(1)
  })

  it("pulls you back when a filter shrinks the list under you", () => {
    // Otherwise page 5 of a now-3-page list renders empty, which reads as "no
    // results" when there are plenty — just not there.
    expect(clampPage(5, 12, 10)).toBe(2)
    expect(clampPage(5, 0, 10)).toBe(1)
  })
})

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1)

  it("cuts the page asked for", () => {
    expect(paginate(items, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(paginate(items, 3, 10)).toEqual([21, 22, 23, 24, 25])
  })

  it("gives the last page rather than nothing when asked past the end", () => {
    expect(paginate(items, 99, 10)).toEqual([21, 22, 23, 24, 25])
  })

  it("covers every item exactly once across all its pages", () => {
    const seen = [
      ...paginate(items, 1, 10),
      ...paginate(items, 2, 10),
      ...paginate(items, 3, 10),
    ]
    expect(seen).toEqual(items)
  })

  it("handles an empty list", () => {
    expect(paginate([], 1, 10)).toEqual([])
  })
})

describe("pageWindow", () => {
  it("lists them all when there are few", () => {
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(2, 3)).toEqual([1, 2, 3])
  })

  it("always offers the first and the last", () => {
    // However long the list, both ends stay one tap away.
    const window = pageWindow(50, 100)
    expect(window[0]).toBe(1)
    expect(window[window.length - 1]).toBe(100)
  })

  it("elides the runs it skips", () => {
    expect(pageWindow(50, 100)).toEqual([1, null, 49, 50, 51, null, 100])
  })

  it("does not leave a gap standing in for a single page", () => {
    // A "…" hiding exactly one page is worse than the page.
    for (const current of [1, 2, 3, 4, 5]) {
      const window = pageWindow(current, 6)
      for (let i = 1; i < window.length - 1; i++) {
        if (window[i] === null) {
          const before = window[i - 1] as number
          const after = window[i + 1] as number
          expect(after - before).toBeGreaterThan(2)
        }
      }
    }
  })

  it("never repeats a page", () => {
    const window = pageWindow(1, 20).filter((p): p is number => p !== null)
    expect(new Set(window).size).toBe(window.length)
  })
})

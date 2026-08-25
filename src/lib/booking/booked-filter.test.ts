import { describe, expect, it } from "vitest"

import {
  grow,
  hasMore,
  INITIAL_VISIBLE,
  matchesQuery,
  referenceOf,
  searchHaystack,
  VISIBLE_STEP,
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
describe("grow", () => {
  it("adds a step at a time", () => {
    expect(grow(INITIAL_VISIBLE, 500)).toBe(INITIAL_VISIBLE + VISIBLE_STEP)
    expect(grow(INITIAL_VISIBLE + VISIBLE_STEP, 500)).toBe(
      INITIAL_VISIBLE + VISIBLE_STEP * 2
    )
  })

  it("never promises more rows than there are", () => {
    expect(grow(INITIAL_VISIBLE, 25)).toBe(25)
    expect(grow(INITIAL_VISIBLE, 0)).toBe(0)
  })

  it("never goes backwards", () => {
    // A filter can shrink the list under a scroll position. Taking rows away
    // from someone mid-read is worse than showing a few too many.
    for (const visible of [0, 1, 5, INITIAL_VISIBLE, 100]) {
      expect(grow(visible, 500)).toBeGreaterThanOrEqual(
        Math.min(visible, 500)
      )
    }
  })

  it("always shows at least the first screenful", () => {
    expect(grow(0, 500)).toBeGreaterThanOrEqual(INITIAL_VISIBLE)
    expect(grow(-10, 500)).toBeGreaterThanOrEqual(INITIAL_VISIBLE)
  })

  it("refuses to stand still on a zero step", () => {
    // A step of zero would make the sentinel fire forever without ever
    // loading anything.
    expect(grow(INITIAL_VISIBLE, 500, 0)).toBeGreaterThan(INITIAL_VISIBLE)
  })
})

describe("hasMore", () => {
  it("knows when the end has been reached", () => {
    expect(hasMore(10, 25)).toBe(true)
    expect(hasMore(25, 25)).toBe(false)
    expect(hasMore(30, 25)).toBe(false)
    expect(hasMore(0, 0)).toBe(false)
  })
})

import { describe, expect, it } from "vitest"

import {
  dayOffset,
  longDate,
  longDateWithYear,
  relativeDayLabel,
  shortDate,
  weekdayOfIso,
} from "./dates"

describe("weekdayOfIso", () => {
  it("reads the day off the date, 0 being Sunday", () => {
    // 2026-03-01 is a Sunday.
    expect(weekdayOfIso("2026-03-01")).toBe(0)
    expect(weekdayOfIso("2026-03-02")).toBe(1)
    expect(weekdayOfIso("2026-03-07")).toBe(6)
  })
})

describe("the written-out forms", () => {
  it("writes a date the way it is said", () => {
    expect(longDate("2026-03-01")).toBe("Sunday, 1 March")
    expect(shortDate("2026-03-07")).toBe("Sat 7 Mar")
  })

  it("adds the year when one is wanted", () => {
    expect(longDateWithYear("2026-03-01")).toBe("Sunday, 1 March 2026")
  })

  it("never goes through the viewer's locale", () => {
    // The server render and the hydrated render have to agree character for
    // character, which Intl does not promise across a locale the server never
    // saw. These are built from the numbers.
    expect(longDate("2026-12-25")).toBe("Friday, 25 December")
  })
})

describe("dayOffset", () => {
  it("counts whole days in either direction", () => {
    expect(dayOffset("2026-03-01", "2026-03-01")).toBe(0)
    expect(dayOffset("2026-03-01", "2026-03-02")).toBe(1)
    expect(dayOffset("2026-03-01", "2026-02-28")).toBe(-1)
    expect(dayOffset("2026-03-01", "2026-03-31")).toBe(30)
  })

  it("crosses a month and a year without drifting", () => {
    expect(dayOffset("2026-12-31", "2027-01-01")).toBe(1)
    expect(dayOffset("2026-01-31", "2026-02-01")).toBe(1)
  })

  it("crosses a leap day", () => {
    // 2028 is a leap year, so February has a 29th.
    expect(dayOffset("2028-02-28", "2028-03-01")).toBe(2)
    expect(dayOffset("2027-02-28", "2027-03-01")).toBe(1)
  })
})

describe("relativeDayLabel", () => {
  const today = "2026-03-10"

  it("says the days either side of today in words", () => {
    // An owner reads a booking list relative to now, not as dates to parse.
    expect(relativeDayLabel("2026-03-10", today)).toBe("Ngayon")
    expect(relativeDayLabel("2026-03-11", today)).toBe("Bukas")
    expect(relativeDayLabel("2026-03-12", today)).toBe("Makalawa")
    expect(relativeDayLabel("2026-03-09", today)).toBe("Kahapon")
  })

  it("writes anything further out in full", () => {
    expect(relativeDayLabel("2026-03-20", today)).toBe("Friday, 20 March")
    expect(relativeDayLabel("2026-03-01", today)).toBe("Sunday, 1 March")
  })

  it("still works across a month boundary", () => {
    expect(relativeDayLabel("2026-04-01", "2026-03-31")).toBe("Bukas")
    expect(relativeDayLabel("2026-02-28", "2026-03-01")).toBe("Kahapon")
  })

  it("never returns an empty label", () => {
    for (const iso of [
      "2026-03-10",
      "2026-03-11",
      "2026-06-15",
      "2020-01-01",
    ]) {
      expect(relativeDayLabel(iso, today).length).toBeGreaterThan(0)
    }
  })
})

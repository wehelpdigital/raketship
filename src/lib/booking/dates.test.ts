import { describe, expect, it } from "vitest"

import {
  dayOffset,
  dayUrgency,
  RELATIVE_DAY_LIMIT,
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
    expect(relativeDayLabel("2026-03-10", today, "fil")).toBe("Ngayon")
    expect(relativeDayLabel("2026-03-11", today, "fil")).toBe("Bukas")
    expect(relativeDayLabel("2026-03-12", today, "fil")).toBe("Makalawa")
    expect(relativeDayLabel("2026-03-09", today, "fil")).toBe("Kahapon")
  })

  it("counts the days once it runs out of words for them", () => {
    // Spelled out and linked, because that is how it is said. "Sa loob ng 3
    // araw" is how a form reads; this is how a person does.
    expect(relativeDayLabel("2026-03-13", today, "fil")).toBe(
      "Sa loob ng tatlong araw"
    )
    expect(relativeDayLabel("2026-03-14", today, "fil")).toBe(
      "Sa loob ng apat na araw"
    )
    expect(relativeDayLabel("2026-03-20", today, "fil")).toBe(
      "Sa loob ng sampung araw"
    )
    expect(relativeDayLabel("2026-03-07", today, "fil")).toBe("tatlong araw na")
    expect(relativeDayLabel("2026-02-28", today, "fil")).toBe("sampung araw na")
  })

  it("marks the two directions unmistakably", () => {
    // A booking read as past when it is coming is a missed booking, and these
    // sit side by side on a 390px row.
    const ahead = relativeDayLabel("2026-03-15", today, "fil")
    const behind = relativeDayLabel("2026-03-05", today, "fil")
    expect(ahead).not.toBe(behind)
    expect(ahead?.startsWith("Sa loob ng ")).toBe(true)
    expect(behind?.endsWith(" araw na")).toBe(true)
  })

  it("stops counting once the number stops meaning anything", () => {
    const edge = (n: number) =>
      new Date(Date.UTC(2026, 2, 10 + n)).toISOString().slice(0, 10)

    expect(relativeDayLabel(edge(RELATIVE_DAY_LIMIT), today, "fil")).toBe(
      "Sa loob ng tatlumpung araw"
    )
    expect(
      relativeDayLabel(edge(RELATIVE_DAY_LIMIT + 1), today, "fil")
    ).toBeNull()
    expect(relativeDayLabel(edge(-RELATIVE_DAY_LIMIT), today, "fil")).toBe(
      "tatlumpung araw na"
    )
    expect(
      relativeDayLabel(edge(-RELATIVE_DAY_LIMIT - 1), today, "fil")
    ).toBeNull()
  })

  it("still works across a month boundary", () => {
    expect(relativeDayLabel("2026-04-01", "2026-03-31", "fil")).toBe("Bukas")
    expect(relativeDayLabel("2026-02-28", "2026-03-01", "fil")).toBe("Kahapon")
  })

  it("never returns an empty string — it is a word or it is nothing", () => {
    for (const iso of [
      "2026-03-10",
      "2026-03-11",
      "2026-06-15",
      "2020-01-01",
    ]) {
      const label = relativeDayLabel(iso, today, "fil")
      expect(label === null || label.length > 0).toBe(true)
    }
  })
})

describe("relativeDayLabel in English", () => {
  const today = "2026-03-10"

  it("says the days either side of today in words", () => {
    expect(relativeDayLabel("2026-03-10", today, "en")).toBe("Today")
    expect(relativeDayLabel("2026-03-11", today, "en")).toBe("Tomorrow")
    expect(relativeDayLabel("2026-03-09", today, "en")).toBe("Yesterday")
  })

  it("keeps the digits, unlike the Filipino side", () => {
    expect(relativeDayLabel("2026-03-12", today, "en")).toBe("In 2 days")
    expect(relativeDayLabel("2026-03-13", today, "en")).toBe("In 3 days")
    expect(relativeDayLabel("2026-03-07", today, "en")).toBe("3 days ago")
  })

  it("stops counting at the same distance in both languages", () => {
    const far = new Date(Date.UTC(2026, 2, 10 + RELATIVE_DAY_LIMIT + 1))
      .toISOString()
      .slice(0, 10)
    expect(relativeDayLabel(far, today, "en")).toBeNull()
    expect(relativeDayLabel(far, today, "fil")).toBeNull()
  })

  it("never leaves a placeholder standing", () => {
    // A visible {n} is the failure mode of an interpolated message.
    for (let n = -30; n <= 30; n++) {
      const iso = new Date(Date.UTC(2026, 2, 10 + n)).toISOString().slice(0, 10)
      for (const locale of ["fil", "en"] as const) {
        const label = relativeDayLabel(iso, today, locale)
        expect(label).not.toBeNull()
        expect(label).not.toContain("{")
      }
    }
  })
})

describe("dayUrgency", () => {
  const today = "2026-03-10"

  it("keeps red for the window an owner cannot let slip", () => {
    expect(dayUrgency("2026-03-10", today)).toBe("now")
    expect(dayUrgency("2026-03-11", today)).toBe("now")
  })

  it("warms the rest of the week", () => {
    expect(dayUrgency("2026-03-12", today)).toBe("soon")
    expect(dayUrgency("2026-03-16", today)).toBe("soon")
  })

  it("goes quiet once there is a week of room", () => {
    expect(dayUrgency("2026-03-17", today)).toBe("later")
    expect(dayUrgency("2026-06-01", today)).toBe("later")
  })

  it("never makes the past urgent", () => {
    // A booking that already happened cannot be missed, and painting last
    // Tuesday red would make the one colour that means "act" mean nothing.
    for (const iso of ["2026-03-09", "2026-03-01", "2025-12-25"]) {
      expect(dayUrgency(iso, today)).toBe("later")
    }
  })

  it("agrees with the label about which day is which", () => {
    expect(relativeDayLabel("2026-03-10", today, "fil")).toBe("Ngayon")
    expect(dayUrgency("2026-03-10", today)).toBe("now")
    expect(relativeDayLabel("2026-03-09", today, "fil")).toBe("Kahapon")
    expect(dayUrgency("2026-03-09", today)).toBe("later")
  })
})

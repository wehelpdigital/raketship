import { describe, expect, it } from "vitest"

import {
  buildSlots,
  calendarDatesTouching,
  dayWindowInZone,
  formatDuration,
  formatTimeLabel,
  joinDuration,
  MINUTE_STEPS,
  splitDuration,
  validateDuration,
  groupAvailabilityByDay,
  instantInZone,
  withinWindow,
  isoDateInZone,
  minutesToTime,
  summariseAvailability,
  timeToMinutes,
  weekdayInZone,
  zoneOffsetMinutes,
  zonedTimeToInstant,
} from "./slots"

const MANILA = "Asia/Manila" // UTC+8, no daylight saving
const NEW_YORK = "America/New_York" // UTC-5 / -4, daylight saving

describe("time helpers", () => {
  it("round-trips minutes and HH:MM", () => {
    expect(minutesToTime(570)).toBe("09:30")
    expect(timeToMinutes("09:30")).toBe(570)
    expect(minutesToTime(0)).toBe("00:00")
    expect(timeToMinutes("00:00")).toBe(0)
  })

  it("rejects values that are not times", () => {
    expect(timeToMinutes("nope")).toBeNull()
    expect(timeToMinutes("25:00")).toBeNull()
    expect(timeToMinutes("10:75")).toBeNull()
  })

  it("formats a 12-hour label", () => {
    expect(formatTimeLabel(0)).toBe("12:00 AM")
    expect(formatTimeLabel(570)).toBe("9:30 AM")
    expect(formatTimeLabel(720)).toBe("12:00 PM")
    expect(formatTimeLabel(1080)).toBe("6:00 PM")
  })
})

describe("timezone maths", () => {
  it("reads a fixed offset", () => {
    expect(zoneOffsetMinutes(new Date("2026-08-24T00:00:00Z"), MANILA)).toBe(480)
  })

  it("tracks daylight saving", () => {
    // January: EST (-5). July: EDT (-4).
    expect(zoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"), NEW_YORK)).toBe(-300)
    expect(zoneOffsetMinutes(new Date("2026-07-15T12:00:00Z"), NEW_YORK)).toBe(-240)
  })

  it("resolves a wall-clock time to the right instant", () => {
    // 09:00 in Manila is 01:00 UTC.
    const d = zonedTimeToInstant("2026-08-24", 9 * 60, MANILA)
    expect(d.toISOString()).toBe("2026-08-24T01:00:00.000Z")
  })

  it("resolves across a daylight-saving boundary", () => {
    // 09:00 EDT is 13:00 UTC; 09:00 EST is 14:00 UTC.
    expect(
      zonedTimeToInstant("2026-07-15", 9 * 60, NEW_YORK).toISOString()
    ).toBe("2026-07-15T13:00:00.000Z")
    expect(
      zonedTimeToInstant("2026-01-15", 9 * 60, NEW_YORK).toISOString()
    ).toBe("2026-01-15T14:00:00.000Z")
  })

  it("reports the local date and weekday, not the UTC one", () => {
    // 23:00 UTC on the 23rd is already 07:00 on the 24th in Manila.
    const instant = new Date("2026-08-23T23:00:00Z")
    expect(isoDateInZone(instant, MANILA)).toBe("2026-08-24")
    expect(isoDateInZone(instant, "UTC")).toBe("2026-08-23")
    expect(weekdayInZone(instant, MANILA)).toBe(1) // Monday
  })

  it("does not throw on an unknown zone", () => {
    expect(() => zoneOffsetMinutes(new Date(), "Not/AZone")).not.toThrow()
    expect(() => isoDateInZone(new Date(), "Not/AZone")).not.toThrow()
  })
})

const RULES = {
  timezone: MANILA,
  durationMinutes: 30,
  bufferMinutes: 0,
  noticeHours: 0,
}

// 2026-08-24 is a Monday.
const MONDAY = "2026-08-24"
const MONDAY_9_TO_11 = [{ weekday: 1, start_minute: 540, end_minute: 660 }]
const LONG_AGO = new Date("2026-01-01T00:00:00Z")

describe("buildSlots", () => {
  it("fills a window at the slot length", () => {
    const slots = buildSlots({
      isoDate: MONDAY,
      rules: RULES,
      availability: MONDAY_9_TO_11,
      blackouts: [],
      taken: [],
      now: LONG_AGO,
    })
    expect(slots.map((s) => s.label)).toEqual([
      "9:00 AM",
      "9:30 AM",
      "10:00 AM",
      "10:30 AM",
    ])
    expect(slots[0].startsAt).toBe("2026-08-24T01:00:00.000Z")
  })

  it("never runs a slot past the end of the window", () => {
    const slots = buildSlots({
      isoDate: MONDAY,
      rules: { ...RULES, durationMinutes: 45 },
      availability: MONDAY_9_TO_11, // 120 minutes
      blackouts: [],
      taken: [],
      now: LONG_AGO,
    })
    expect(slots.map((s) => s.label)).toEqual(["9:00 AM", "9:45 AM"])
  })

  it("leaves a gap between slots when a buffer is set", () => {
    const slots = buildSlots({
      isoDate: MONDAY,
      rules: { ...RULES, bufferMinutes: 15 },
      availability: MONDAY_9_TO_11,
      blackouts: [],
      taken: [],
      now: LONG_AGO,
    })
    expect(slots.map((s) => s.label)).toEqual(["9:00 AM", "9:45 AM", "10:30 AM"])
  })

  it("returns nothing on a weekday with no rule", () => {
    expect(
      buildSlots({
        isoDate: "2026-08-25", // Tuesday
        rules: RULES,
        availability: MONDAY_9_TO_11,
        blackouts: [],
        taken: [],
        now: LONG_AGO,
      })
    ).toEqual([])
  })

  it("returns nothing on a blacked-out date", () => {
    expect(
      buildSlots({
        isoDate: MONDAY,
        rules: RULES,
        availability: MONDAY_9_TO_11,
        blackouts: [{ date: MONDAY }],
        taken: [],
        now: LONG_AGO,
      })
    ).toEqual([])
  })

  it("drops a slot that is already booked", () => {
    const slots = buildSlots({
      isoDate: MONDAY,
      rules: RULES,
      availability: MONDAY_9_TO_11,
      blackouts: [],
      taken: [
        {
          startsAt: "2026-08-24T01:30:00.000Z", // 9:30 Manila
          endsAt: "2026-08-24T02:00:00.000Z",
        },
      ],
      now: LONG_AGO,
    })
    expect(slots.map((s) => s.label)).toEqual(["9:00 AM", "10:00 AM", "10:30 AM"])
  })

  it("drops every slot a longer booking straddles", () => {
    const slots = buildSlots({
      isoDate: MONDAY,
      rules: RULES,
      availability: MONDAY_9_TO_11,
      blackouts: [],
      taken: [
        {
          startsAt: "2026-08-24T01:15:00.000Z", // 9:15–10:15 Manila
          endsAt: "2026-08-24T02:15:00.000Z",
        },
      ],
      now: LONG_AGO,
    })
    // 9:00 overlaps 9:15, 9:30 and 10:00 sit inside it; only 10:30 survives.
    expect(slots.map((s) => s.label)).toEqual(["10:30 AM"])
  })

  it("honours the notice window", () => {
    const slots = buildSlots({
      isoDate: MONDAY,
      rules: { ...RULES, noticeHours: 2 },
      availability: MONDAY_9_TO_11,
      // "now" is 8:00 Manila, so 2 hours' notice rules out 9:00 and 9:30.
      blackouts: [],
      taken: [],
      now: new Date("2026-08-24T00:00:00Z"),
    })
    expect(slots.map((s) => s.label)).toEqual(["10:00 AM", "10:30 AM"])
  })

  it("handles two windows in one day without duplicating", () => {
    const slots = buildSlots({
      isoDate: MONDAY,
      rules: { ...RULES, durationMinutes: 60 },
      availability: [
        { weekday: 1, start_minute: 540, end_minute: 660 }, // 9–11
        { weekday: 1, start_minute: 840, end_minute: 960 }, // 14–16
      ],
      blackouts: [],
      taken: [],
      now: LONG_AGO,
    })
    expect(slots.map((s) => s.label)).toEqual([
      "9:00 AM",
      "10:00 AM",
      "2:00 PM",
      "3:00 PM",
    ])
  })

  it("refuses a zero-length appointment rather than looping forever", () => {
    expect(
      buildSlots({
        isoDate: MONDAY,
        rules: { ...RULES, durationMinutes: 0 },
        availability: MONDAY_9_TO_11,
        blackouts: [],
        taken: [],
        now: LONG_AGO,
      })
    ).toEqual([])
  })

  it("uses the calendar's weekday, not the server's", () => {
    // 2026-08-24T00:30Z is still Sunday in New York but Monday in Manila.
    const slots = buildSlots({
      isoDate: MONDAY,
      rules: RULES,
      availability: MONDAY_9_TO_11,
      blackouts: [],
      taken: [],
      now: LONG_AGO,
    })
    expect(slots.length).toBeGreaterThan(0)
  })
})

describe("summariseAvailability", () => {
  it("says so when nothing is set", () => {
    expect(summariseAvailability([])).toBe("No days set yet")
  })

  it("groups ranges under each day, in weekday order", () => {
    expect(
      summariseAvailability([
        { weekday: 3, start_minute: 540, end_minute: 720 },
        { weekday: 1, start_minute: 840, end_minute: 960 },
        { weekday: 1, start_minute: 540, end_minute: 660 },
      ])
    ).toBe("Mon 9:00 AM–11:00 AM, 2:00 PM–4:00 PM · Wed 9:00 AM–12:00 PM")
  })
})

describe("groupAvailabilityByDay", () => {
  it("returns all seven days so the week reads as seven rows", () => {
    const days = groupAvailabilityByDay([])
    expect(days).toHaveLength(7)
    expect(days.map((d) => d.short)).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ])
    expect(days.every((d) => d.ranges.length === 0)).toBe(true)
  })

  it("keeps each day's ranges to that day, earliest first", () => {
    const days = groupAvailabilityByDay([
      { weekday: 1, start_minute: 780, end_minute: 1020 },
      { weekday: 1, start_minute: 540, end_minute: 720 },
      { weekday: 3, start_minute: 600, end_minute: 660 },
    ])
    expect(days[1].ranges).toEqual([
      "9:00 AM – 12:00 PM",
      "1:00 PM – 5:00 PM",
    ])
    expect(days[3].ranges).toEqual(["10:00 AM – 11:00 AM"])
    expect(days[2].ranges).toEqual([])
  })

  it("drops a range that ends before it starts rather than printing it", () => {
    const days = groupAvailabilityByDay([
      { weekday: 2, start_minute: 600, end_minute: 600 },
      { weekday: 2, start_minute: 900, end_minute: 800 },
    ])
    expect(days[2].ranges).toEqual([])
  })

  it("carries the long name for a tooltip", () => {
    expect(groupAvailabilityByDay([])[5].long).toBe("Friday")
  })
})

describe("instantInZone", () => {
  // 2026-09-07T01:00:00Z is 9:00 AM in Manila (UTC+8).
  const NINE_AM_MANILA = "2026-09-07T01:00:00.000Z"

  it("reads an instant in the calendar's own zone", () => {
    expect(instantInZone(NINE_AM_MANILA, MANILA)).toEqual({
      time: "9:00 AM",
      isoDate: "2026-09-07",
    })
  })

  it("shifts the clock AND the date for a viewer further west", () => {
    // 9am Monday in Manila is 9pm the previous evening in New York.
    expect(instantInZone(NINE_AM_MANILA, NEW_YORK)).toEqual({
      time: "9:00 PM",
      isoDate: "2026-09-06",
    })
  })

  it("returns the date so a caller can flag a day that moved", () => {
    const here = instantInZone(NINE_AM_MANILA, MANILA)
    const there = instantInZone(NINE_AM_MANILA, NEW_YORK)
    // This difference is the whole reason the date comes back at all.
    expect(here.isoDate).not.toBe(there.isoDate)
  })

  it("tracks daylight saving rather than a fixed offset", () => {
    // London is BST (+1) in July and GMT (+0) in January.
    expect(instantInZone("2026-07-15T12:00:00.000Z", "Europe/London").time).toBe(
      "1:00 PM"
    )
    expect(instantInZone("2026-01-15T12:00:00.000Z", "Europe/London").time).toBe(
      "12:00 PM"
    )
  })

  it("renders midnight as 12:00 AM, not 24:00", () => {
    expect(instantInZone("2026-09-06T16:00:00.000Z", MANILA).time).toBe(
      "12:00 AM"
    )
  })

  it("does not throw on rubbish input", () => {
    expect(instantInZone("not-a-date", MANILA)).toEqual({
      time: "",
      isoDate: "",
    })
    expect(() => instantInZone(NINE_AM_MANILA, "Not/AZone")).not.toThrow()
  })
})

describe("a viewer's day versus the calendar's day", () => {
  it("spans midnight to midnight in the viewer's own zone", () => {
    const w = dayWindowInZone("2026-09-07", MANILA)
    // Manila is UTC+8, so its Monday starts at 16:00 UTC the day before.
    expect(w.start.toISOString()).toBe("2026-09-06T16:00:00.000Z")
    expect(w.end.toISOString()).toBe("2026-09-07T16:00:00.000Z")
  })

  it("touches two of the calendar's dates when the zones differ", () => {
    // A New Yorker's Monday overlaps the shop's Monday AND Tuesday in Manila.
    const w = dayWindowInZone("2026-09-07", NEW_YORK)
    expect(calendarDatesTouching(w, MANILA)).toEqual(["2026-09-07", "2026-09-08"])
  })

  it("touches exactly one date when the viewer is in the shop's zone", () => {
    const w = dayWindowInZone("2026-09-07", MANILA)
    expect(calendarDatesTouching(w, MANILA)).toEqual(["2026-09-07"])
  })

  it("does not claim a day the window only just fails to reach", () => {
    // The window is exclusive at the end; midnight belongs to the next day.
    const w = dayWindowInZone("2026-09-07", MANILA)
    const dates = calendarDatesTouching(w, MANILA)
    expect(dates).not.toContain("2026-09-08")
  })

  it("places a shop's morning slot in the previous day for a viewer out west", () => {
    // 9am Monday in Manila is 9pm SUNDAY in New York — this is the case that
    // made grouping by the shop's day wrong.
    const nineAmManila = "2026-09-07T01:00:00.000Z"
    const nyMonday = dayWindowInZone("2026-09-07", NEW_YORK)
    const nySunday = dayWindowInZone("2026-09-06", NEW_YORK)

    expect(withinWindow(nineAmManila, nySunday)).toBe(true)
    expect(withinWindow(nineAmManila, nyMonday)).toBe(false)
  })

  it("keeps that same instant inside the shop's own Monday", () => {
    const nineAmManila = "2026-09-07T01:00:00.000Z"
    expect(
      withinWindow(nineAmManila, dayWindowInZone("2026-09-07", MANILA))
    ).toBe(true)
  })

  it("handles a viewer far to the east too", () => {
    // Auckland is ahead of Manila, so its day reaches back into the shop's
    // previous date rather than forward.
    const w = dayWindowInZone("2026-09-07", "Pacific/Auckland")
    expect(calendarDatesTouching(w, MANILA)).toEqual(["2026-09-06", "2026-09-07"])
  })
})

describe("lengths", () => {
  it("splits and rejoins without drift", () => {
    expect(splitDuration(90)).toEqual({ hours: 1, minutes: 30 })
    expect(joinDuration({ hours: 1, minutes: 30 })).toBe(90)
    expect(joinDuration(splitDuration(455))).toBe(455)
  })

  it("writes a length out rather than as a clock time", () => {
    // "1:30" on a page full of clock times reads as half past one.
    expect(formatDuration(90)).toBe("1 hr 30 min")
    expect(formatDuration(45)).toBe("45 min")
    expect(formatDuration(120)).toBe("2 hrs")
    expect(formatDuration(60)).toBe("1 hr")
    expect(formatDuration(0)).toBe("0 min")
  })

  it("mirrors the bounds the database enforces", () => {
    expect(validateDuration(30)).toBeNull()
    expect(validateDuration(0)).toMatch(/at least/)
    expect(validateDuration(4)).toMatch(/at least/)
    expect(validateDuration(481)).toMatch(/at most/)
    expect(validateDuration(1.5)).toMatch(/Pick a length/)
  })

  it("offers minutes in tens, which is how people describe a job", () => {
    expect([...MINUTE_STEPS]).toEqual([0, 10, 20, 30, 40, 50])
  })
})

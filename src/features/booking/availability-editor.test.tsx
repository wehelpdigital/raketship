import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  ALL_TIMEZONES,
  AvailabilityEditor,
  DEFAULT_END,
  DEFAULT_START,
  type DayRow,
  type SavedRule,
  collectErrors,
  copyMondayToWeekdays,
  dayError,
  dayInZone,
  formatIsoDay,
  formatIsoLong,
  formatOpenHours,
  gmtLabel,
  groupBlackoutsByMonth,
  hasBlackout,
  isValidIsoDate,
  makeRange,
  rangeError,
  rangesOverlap,
  rowsFromAvailability,
  rulesFromAvailability,
  rulesFromRows,
  signatureOf,
  suggestNextRange,
  suggestedZones,
  summariseDay,
  timeInZone,
  weekdayPreset,
  weeklyOpenMinutes,
  zoneArea,
  zoneLabel,
} from "@/features/booking/availability-editor"
import type {
  BookingAvailabilityRow,
  BookingBlackoutRow,
  BookingCalendarRow,
} from "@/lib/supabase/types"

import {
  addBlackout,
  removeBlackout,
  setAvailability,
  updateCalendar,
} from "@/features/booking/actions"

// The real actions reach for a session and a database. The editor is under
// test, not them, so the module is stubbed and its calls are read back.
vi.mock("@/features/booking/actions", () => ({
  setAvailability: vi.fn(),
  addBlackout: vi.fn(),
  removeBlackout: vi.fn(),
  updateCalendar: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(setAvailability).mockResolvedValue({ ok: true })
  vi.mocked(addBlackout).mockResolvedValue({ ok: true })
  vi.mocked(removeBlackout).mockResolvedValue({ ok: true })
  vi.mocked(updateCalendar).mockResolvedValue({ ok: true })
})

function row(weekday: number, ranges: [string, string][], enabled = true): DayRow {
  return {
    weekday,
    enabled,
    ranges: ranges.map(([start, end]) => makeRange(start, end)),
  }
}

function saved(weekday: number, start: number, end: number): SavedRule {
  return { weekday, start_minute: start, end_minute: end }
}

// =============================================================================
// minutes <-> "HH:MM", through the row state
// =============================================================================

describe("the minutes / HH:MM round trip", () => {
  it("turns stored minutes into times the picker understands", () => {
    const rows = rowsFromAvailability([saved(1, 540, 1020)])
    const monday = rows[1]

    expect(monday.weekday).toBe(1)
    expect(monday.enabled).toBe(true)
    expect(monday.ranges).toHaveLength(1)
    expect(monday.ranges[0].start).toBe("09:00")
    expect(monday.ranges[0].end).toBe("17:00")
  })

  it("comes back out as the same minutes", () => {
    const rules = [saved(0, 0, 60), saved(2, 570, 725), saved(6, 1380, 1439)]
    expect(rulesFromRows(rowsFromAvailability(rules))).toEqual(
      rulesFromAvailability(rules)
    )
  })

  it("survives the trip unchanged, however many ranges a day has", () => {
    const rules = [
      saved(1, 540, 720),
      saved(1, 780, 1020),
      saved(3, 480, 660),
      saved(5, 600, 900),
    ]
    const before = signatureOf(rulesFromAvailability(rules))
    const after = signatureOf(rulesFromRows(rowsFromAvailability(rules)))
    expect(after).toBe(before)
  })

  it("sorts what it sends back, whatever order it arrived in", () => {
    const rules = rulesFromRows(
      rowsFromAvailability([saved(3, 780, 1020), saved(1, 540, 720), saved(3, 540, 720)])
    )
    expect(rules).toEqual([
      { weekday: 1, startMinute: 540, endMinute: 720 },
      { weekday: 3, startMinute: 540, endMinute: 720 },
      { weekday: 3, startMinute: 780, endMinute: 1020 },
    ])
  })
})

describe("rowsFromAvailability", () => {
  it("always lays out seven days, Sunday first", () => {
    const rows = rowsFromAvailability([])
    expect(rows).toHaveLength(7)
    expect(rows.map((r) => r.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it("leaves untouched days closed but pre-filled", () => {
    const sunday = rowsFromAvailability([saved(1, 540, 1020)])[0]
    expect(sunday.enabled).toBe(false)
    expect(sunday.ranges[0].start).toBe(DEFAULT_START)
    expect(sunday.ranges[0].end).toBe(DEFAULT_END)
  })

  it("ignores rows the database should never have held", () => {
    const rows = rowsFromAvailability([
      saved(9, 540, 1020),
      saved(-1, 540, 1020),
      saved(2, 600, 600),
      saved(2, 700, 600),
    ])
    expect(rows.every((r) => !r.enabled)).toBe(true)
    expect(rulesFromRows(rows)).toEqual([])
  })

  it("gives every range its own key", () => {
    const rows = rowsFromAvailability([saved(1, 540, 720), saved(1, 780, 1020)])
    const [first, second] = rows[1].ranges
    expect(first.id).not.toBe(second.id)
  })
})

describe("rulesFromRows", () => {
  it("skips days that are switched off", () => {
    expect(rulesFromRows([row(1, [["09:00", "17:00"]], false)])).toEqual([])
  })

  it("never sends a range that would fail the database check", () => {
    expect(
      rulesFromRows([row(1, [["17:00", "09:00"], ["12:00", "12:00"], ["", "17:00"]])])
    ).toEqual([])
  })
})

// =============================================================================
// end after start
// =============================================================================

describe("rangeError", () => {
  it("passes a sane range", () => {
    expect(rangeError(makeRange("09:00", "17:00"))).toBeNull()
  })

  it("catches an end before the start", () => {
    expect(rangeError(makeRange("17:00", "09:00"))).toBe(
      "The end time has to be after the start."
    )
  })

  it("catches an end equal to the start", () => {
    expect(rangeError(makeRange("09:00", "09:00"))).toBe(
      "Start and end are the same time."
    )
  })

  it("catches a half-filled range", () => {
    expect(rangeError(makeRange("", "17:00"))).toBe(
      "Add both a start and an end time."
    )
    expect(rangeError(makeRange("09:00", "   "))).toBe(
      "Add both a start and an end time."
    )
  })

  it("catches something that is not a time at all", () => {
    expect(rangeError(makeRange("nine-ish", "17:00"))).toBe(
      "That time does not look right — use the picker."
    )
    expect(rangeError(makeRange("09:00", "25:00"))).toBe(
      "That time does not look right — use the picker."
    )
  })

  it("allows a range that ends at midnight", () => {
    expect(rangeError(makeRange("18:00", "24:00"))).toBeNull()
  })
})

// =============================================================================
// overlap
// =============================================================================

describe("rangesOverlap", () => {
  it("spots a plain overlap", () => {
    expect(
      rangesOverlap(makeRange("09:00", "12:00"), makeRange("11:00", "15:00"))
    ).toBe(true)
  })

  it("does not care which one is passed first", () => {
    expect(
      rangesOverlap(makeRange("11:00", "15:00"), makeRange("09:00", "12:00"))
    ).toBe(true)
  })

  it("spots one range swallowing another", () => {
    expect(
      rangesOverlap(makeRange("09:00", "18:00"), makeRange("12:00", "13:00"))
    ).toBe(true)
  })

  it("lets two ranges touch at the same minute", () => {
    expect(
      rangesOverlap(makeRange("09:00", "12:00"), makeRange("12:00", "17:00"))
    ).toBe(false)
  })

  it("leaves a gap alone", () => {
    expect(
      rangesOverlap(makeRange("09:00", "12:00"), makeRange("13:00", "17:00"))
    ).toBe(false)
  })

  it("stays quiet when a range cannot be read — rangeError says that instead", () => {
    expect(rangesOverlap(makeRange("", ""), makeRange("09:00", "17:00"))).toBe(false)
  })
})

describe("dayError", () => {
  it("says nothing about a closed day, however broken its ranges look", () => {
    expect(dayError(row(0, [["17:00", "09:00"]], false))).toBeNull()
  })

  it("accepts the lunch-break shape", () => {
    expect(dayError(row(1, [["09:00", "12:00"], ["13:00", "17:00"]]))).toBeNull()
  })

  it("names both sides of an overlap", () => {
    const message = dayError(row(1, [["09:00", "12:00"], ["11:00", "15:00"]]))
    expect(message).toBe("9:00 AM–12:00 PM overlaps 11:00 AM–3:00 PM.")
  })

  it("finds an overlap no matter the order the ranges were added in", () => {
    const message = dayError(row(1, [["13:00", "17:00"], ["09:00", "14:00"]]))
    expect(message).toBe("9:00 AM–2:00 PM overlaps 1:00 PM–5:00 PM.")
  })

  it("reports a broken range before hunting for overlaps", () => {
    expect(dayError(row(1, [["17:00", "09:00"], ["17:00", "18:00"]]))).toBe(
      "The end time has to be after the start."
    )
  })

  it("asks for hours on a day that is open with none", () => {
    expect(dayError({ weekday: 4, enabled: true, ranges: [] })).toBe(
      "Add a time range, or switch the day off."
    )
  })
})

describe("collectErrors", () => {
  it("keys every problem by its weekday and skips the healthy days", () => {
    const errors = collectErrors([
      row(0, [["09:00", "17:00"]], false),
      row(1, [["09:00", "17:00"]]),
      row(2, [["17:00", "09:00"]]),
      row(3, [["09:00", "12:00"], ["11:00", "13:00"]]),
    ])
    expect(Object.keys(errors)).toEqual(["2", "3"])
    expect(errors[2]).toBe("The end time has to be after the start.")
  })

  it("is empty for a clean week", () => {
    expect(collectErrors(weekdayPreset())).toEqual({})
  })
})

// =============================================================================
// the convenience edits
// =============================================================================

describe("copyMondayToWeekdays", () => {
  const week = [
    row(0, [["09:00", "12:00"]]),
    row(1, [["08:00", "12:00"], ["13:00", "17:00"]]),
    row(2, [["10:00", "11:00"]], false),
    row(3, [["10:00", "11:00"]], false),
    row(4, [["10:00", "11:00"]], false),
    row(5, [["10:00", "11:00"]], false),
    row(6, [["09:00", "12:00"]]),
  ]

  it("puts Monday's hours on Tuesday through Friday", () => {
    const copied = copyMondayToWeekdays(week)
    for (const weekday of [2, 3, 4, 5]) {
      expect(copied[weekday].enabled).toBe(true)
      expect(copied[weekday].ranges.map((r) => [r.start, r.end])).toEqual([
        ["08:00", "12:00"],
        ["13:00", "17:00"],
      ])
    }
  })

  it("leaves the weekend and Monday itself alone", () => {
    const copied = copyMondayToWeekdays(week)
    expect(copied[0]).toBe(week[0])
    expect(copied[1]).toBe(week[1])
    expect(copied[6]).toBe(week[6])
  })

  it("clones the ranges instead of sharing them", () => {
    const copied = copyMondayToWeekdays(week)
    expect(copied[2].ranges[0].id).not.toBe(copied[3].ranges[0].id)
    expect(copied[2].ranges[0]).not.toBe(week[1].ranges[0])
  })

  it("carries a closed Monday across too", () => {
    const closed = copyMondayToWeekdays([
      row(1, [["09:00", "17:00"]], false),
      row(2, [["09:00", "17:00"]]),
    ])
    expect(closed[1].enabled).toBe(false)
  })
})

describe("suggestNextRange", () => {
  it("starts an hour after the last range ends", () => {
    const next = suggestNextRange([makeRange("09:00", "12:00")])
    expect(next).not.toBeNull()
    expect(next?.start).toBe("13:00")
    expect(next?.end).toBe("15:00")
  })

  it("looks at the latest range, not the last one typed", () => {
    const next = suggestNextRange([
      makeRange("13:00", "17:00"),
      makeRange("09:00", "12:00"),
    ])
    expect(next?.start).toBe("18:00")
  })

  it("offers the working day when there is nothing to go on", () => {
    const next = suggestNextRange([])
    expect(next?.start).toBe(DEFAULT_START)
    expect(next?.end).toBe(DEFAULT_END)
  })

  it("refuses when the day has no room left", () => {
    expect(suggestNextRange([makeRange("09:00", "23:30")])).toBeNull()
  })
})

describe("weekdayPreset", () => {
  it("opens Monday to Friday at nine to five and shuts the weekend", () => {
    const rows = weekdayPreset()
    expect(rows.filter((r) => r.enabled).map((r) => r.weekday)).toEqual([1, 2, 3, 4, 5])
    expect(rulesFromRows(rows)).toHaveLength(5)
    expect(weeklyOpenMinutes(rows)).toBe(5 * 8 * 60)
  })
})

describe("weeklyOpenMinutes and formatOpenHours", () => {
  it("adds only the ranges that are usable", () => {
    expect(
      weeklyOpenMinutes([
        row(1, [["09:00", "12:00"], ["13:00", "17:00"]]),
        row(2, [["17:00", "09:00"]]),
        row(3, [["09:00", "17:00"]], false),
      ])
    ).toBe(420)
  })

  it("reads as hours", () => {
    expect(formatOpenHours(0)).toBe("No hours yet")
    expect(formatOpenHours(60)).toBe("1 hour open each week")
    expect(formatOpenHours(2310)).toBe("38.5 hours open each week")
  })
})

describe("summariseDay", () => {
  it("says closed when the day is off", () => {
    expect(summariseDay(row(0, [["09:00", "17:00"]], false))).toBe("Closed")
  })

  it("lists the ranges in order", () => {
    expect(summariseDay(row(1, [["13:00", "17:00"], ["09:00", "12:00"]]))).toBe(
      "9:00 AM–12:00 PM · 1:00 PM–5:00 PM"
    )
  })

  it("nudges when an open day has nothing readable", () => {
    expect(summariseDay(row(1, [["", ""]]))).toBe("Set the hours")
  })
})

// =============================================================================
// blackout dates
// =============================================================================

function blackout(
  id: string,
  date: string,
  reason: string | null = null
): BookingBlackoutRow {
  return {
    id,
    calendar_id: "cal-1",
    user_id: "user-1",
    date,
    reason,
    created_at: "2026-01-01T00:00:00.000Z",
  }
}

describe("isValidIsoDate", () => {
  it("accepts a real date", () => {
    expect(isValidIsoDate("2026-08-24")).toBe(true)
  })

  it("rejects anything the date input would not produce", () => {
    expect(isValidIsoDate("")).toBe(false)
    expect(isValidIsoDate("24-08-2026")).toBe(false)
    expect(isValidIsoDate("2026-8-4")).toBe(false)
  })

  it("rejects a day that does not exist", () => {
    expect(isValidIsoDate("2026-02-30")).toBe(false)
    expect(isValidIsoDate("2026-13-01")).toBe(false)
  })

  it("knows its leap years", () => {
    expect(isValidIsoDate("2024-02-29")).toBe(true)
    expect(isValidIsoDate("2026-02-29")).toBe(false)
  })
})

describe("hasBlackout", () => {
  it("spots a date that is already blocked, so the unique index never fires", () => {
    const rows = [blackout("a", "2026-08-24"), blackout("b", "2026-12-25")]
    expect(hasBlackout(rows, "2026-12-25")).toBe(true)
    expect(hasBlackout(rows, "2026-12-26")).toBe(false)
  })
})

describe("groupBlackoutsByMonth", () => {
  const rows = [
    blackout("c", "2026-12-25", "Pasko"),
    blackout("a", "2026-08-30"),
    blackout("b", "2026-08-24", "Out of town"),
  ]

  it("groups by month, ascending, with the days in order", () => {
    const months = groupBlackoutsByMonth(rows, "2026-08-26")
    expect(months.map((m) => m.key)).toEqual(["2026-08", "2026-12"])
    expect(months[0].label).toBe("August 2026")
    expect(months[0].items.map((i) => i.row.date)).toEqual([
      "2026-08-24",
      "2026-08-30",
    ])
  })

  it("flags the days that have already gone by", () => {
    const months = groupBlackoutsByMonth(rows, "2026-08-26")
    expect(months[0].items.map((i) => i.isPast)).toEqual([true, false])
  })

  it("flags nothing until today is known on the client", () => {
    const months = groupBlackoutsByMonth(rows, null)
    expect(months.flatMap((m) => m.items).every((i) => !i.isPast)).toBe(true)
  })

  it("returns nothing for an empty calendar", () => {
    expect(groupBlackoutsByMonth([], "2026-08-26")).toEqual([])
  })
})

describe("date labels", () => {
  it("reads the weekday off the date itself, not the browser's zone", () => {
    expect(formatIsoDay("2026-08-24")).toBe("Mon 24")
    expect(formatIsoLong("2026-08-24")).toBe("Monday, 24 August 2026")
  })

  it("hands back anything it cannot read", () => {
    expect(formatIsoDay("someday")).toBe("someday")
    expect(formatIsoLong("someday")).toBe("someday")
  })
})

// =============================================================================
// country and timezone
// =============================================================================

describe("the timezone list", () => {
  it("is built without throwing, whatever the runtime supports", () => {
    expect(ALL_TIMEZONES.length).toBeGreaterThan(0)
    expect(ALL_TIMEZONES).toContain("Asia/Manila")
    expect(ALL_TIMEZONES).toContain("UTC")
  })

  it("holds no duplicates", () => {
    expect(new Set(ALL_TIMEZONES).size).toBe(ALL_TIMEZONES.length)
  })
})

describe("zoneLabel and zoneArea", () => {
  it("reads the city out of a zone", () => {
    expect(zoneLabel("Asia/Manila")).toBe("Manila")
    expect(zoneLabel("America/Los_Angeles")).toBe("Los Angeles")
    expect(zoneLabel("America/Argentina/Buenos_Aires")).toBe("Buenos Aires, Argentina")
    expect(zoneLabel("UTC")).toBe("UTC")
  })

  it("reads the area out of a zone", () => {
    expect(zoneArea("Asia/Manila")).toBe("Asia")
    expect(zoneArea("UTC")).toBe("Other")
  })
})

describe("suggestedZones", () => {
  it("puts the current zone first and adds the country's own", () => {
    expect(suggestedZones("SG", "Asia/Singapore")[0]).toBe("Asia/Singapore")
    expect(suggestedZones("US", "Asia/Manila")).toContain("America/New_York")
  })

  it("keeps home and UTC within reach", () => {
    const zones = suggestedZones("GB", "Europe/London")
    expect(zones).toContain("Asia/Manila")
    expect(zones).toContain("UTC")
  })

  it("repeats nothing", () => {
    const zones = suggestedZones("PH", "Asia/Manila")
    expect(new Set(zones).size).toBe(zones.length)
  })

  it("copes with a country it has never heard of", () => {
    expect(suggestedZones("ZZ", "Asia/Manila")).toEqual(["Asia/Manila", "UTC"])
  })
})

describe("the live clock", () => {
  it("reads the wall clock in the calendar's zone", () => {
    const instant = new Date("2026-08-24T08:32:00.000Z")
    expect(timeInZone(instant, "Asia/Manila")).toBe("4:32 PM")
    expect(dayInZone(instant, "Asia/Manila")).toBe("Monday, Aug 24")
  })

  it("goes quiet rather than throwing on a zone the runtime rejects", () => {
    expect(timeInZone(new Date(), "Not/AZone")).toBeNull()
    expect(dayInZone(new Date(), "Not/AZone")).toBeNull()
  })
})

describe("gmtLabel", () => {
  it("writes whole-hour offsets plainly", () => {
    expect(gmtLabel(480)).toBe("GMT+8")
    expect(gmtLabel(-300)).toBe("GMT-5")
    expect(gmtLabel(0)).toBe("GMT")
  })

  it("keeps the half and quarter hours", () => {
    expect(gmtLabel(330)).toBe("GMT+5:30")
    expect(gmtLabel(345)).toBe("GMT+5:45")
    expect(gmtLabel(-210)).toBe("GMT-3:30")
  })
})

// =============================================================================
// the editor itself
// =============================================================================

/** A saved weekly window, as the page hands it down. */
function storedRule(
  id: string,
  weekday: number,
  start: number,
  end: number
): BookingAvailabilityRow {
  return {
    id,
    calendar_id: "cal-1",
    user_id: "user-1",
    weekday,
    start_minute: start,
    end_minute: end,
    created_at: "2026-01-01T00:00:00.000Z",
  }
}

const CALENDAR: BookingCalendarRow = {
  id: "cal-1",
  user_id: "user-1",
  name: "Gupit",
  description: null,
  slug: "gupit",
  timezone: "Asia/Manila",
  country: "PH",
  duration_minutes: 30,
  buffer_minutes: 0,
  notice_hours: 2,
  cancel_notice_hours: 24,
  send_confirmation_email: true,
  send_reminder_email: true,
  reminder_lead_minutes: 1440,
  booking_horizon_days: 14,
  length_mode: "fixed" as const,
  is_published: false,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
}

describe("AvailabilityEditor", () => {
  it("renders a calendar with nothing set yet", () => {
    render(
      <AvailabilityEditor calendar={CALENDAR} availability={[]} blackouts={[]} />
    )

    const switches = screen.getAllByRole("switch")
    expect(switches).toHaveLength(7)
    expect(switches.every((day) => day.getAttribute("aria-checked") === "false")).toBe(
      true
    )
    expect(screen.getAllByText("Closed")).toHaveLength(7)
    expect(screen.getByText(/No closed days yet/)).toBeInTheDocument()
  })

  it("names the calendar's own zone next to the hours", () => {
    render(
      <AvailabilityEditor calendar={CALENDAR} availability={[]} blackouts={[]} />
    )
    expect(
      screen.getByText("Every time below is read in Manila time.")
    ).toBeInTheDocument()
  })

  it("sends the week as minutes from midnight", async () => {
    const user = userEvent.setup()
    render(
      <AvailabilityEditor calendar={CALENDAR} availability={[]} blackouts={[]} />
    )

    await user.click(screen.getByRole("switch", { name: "Monday" }))
    await user.click(screen.getByRole("button", { name: "Save weekly hours" }))

    await waitFor(() => expect(setAvailability).toHaveBeenCalledTimes(1))
    expect(setAvailability).toHaveBeenCalledWith({
      calendarId: "cal-1",
      rules: [{ weekday: 1, startMinute: 540, endMinute: 1020 }],
    })
  })

  it("will not save a week that still has a problem in it", async () => {
    const user = userEvent.setup()
    render(
      <AvailabilityEditor
        calendar={CALENDAR}
        availability={[
          storedRule("a", 1, 540, 720),
          storedRule("b", 1, 660, 900),
        ]}
        blackouts={[]}
      />
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
      "9:00 AM–12:00 PM overlaps 11:00 AM–3:00 PM."
    )
    await user.click(screen.getByRole("button", { name: "Save weekly hours" }))
    expect(setAvailability).not.toHaveBeenCalled()
  })

  it("blocks a date by its ISO day, not by whatever the browser printed", async () => {
    const user = userEvent.setup()
    render(
      <AvailabilityEditor calendar={CALENDAR} availability={[]} blackouts={[]} />
    )

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-12-25" },
    })
    await user.click(screen.getByRole("button", { name: "Block this date" }))

    await waitFor(() => expect(addBlackout).toHaveBeenCalledTimes(1))
    expect(addBlackout).toHaveBeenCalledWith({
      calendarId: "cal-1",
      date: "2026-12-25",
    })
  })

  it("refuses a date that is already closed before the database has to", async () => {
    const user = userEvent.setup()
    render(
      <AvailabilityEditor
        calendar={CALENDAR}
        availability={[]}
        blackouts={[blackout("x", "2026-12-25", "Pasko")]}
      />
    )

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-12-25" },
    })
    await user.click(screen.getByRole("button", { name: "Block this date" }))

    expect(addBlackout).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Friday, 25 December 2026 is already blocked."
    )
  })
})

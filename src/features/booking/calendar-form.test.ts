import { describe, expect, it, vi } from "vitest"

import {
  BUFFERS,
  DURATIONS,
  NOTICES,
  minuteLabel,
  noticeLabel,
  withCurrent,
} from "@/features/booking/calendar-form"

// The form pulls in the server actions; only its pure helpers are under test
// here, so that module is stubbed rather than dragged into the environment.
vi.mock("@/features/booking/actions", () => ({
  createCalendar: vi.fn(),
  updateCalendar: vi.fn(),
  deleteCalendar: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// =============================================================================

describe("minuteLabel", () => {
  it("names a gap of nothing rather than printing a zero", () => {
    expect(minuteLabel(0)).toBe("No gap")
  })

  it("keeps sub-hour lengths in minutes", () => {
    expect(minuteLabel(15)).toBe("15 minutes")
    expect(minuteLabel(45)).toBe("45 minutes")
  })

  it("switches to hours on the hour, singular where it should be", () => {
    expect(minuteLabel(60)).toBe("1 hour")
    expect(minuteLabel(120)).toBe("2 hours")
  })

  it("says both parts when the length is not a round hour", () => {
    expect(minuteLabel(90)).toBe("1 hour 30 min")
    expect(minuteLabel(150)).toBe("2 hours 30 min")
  })

  it("labels every preset without falling through to a blank", () => {
    for (const value of [...DURATIONS, ...BUFFERS]) {
      expect(minuteLabel(value).length).toBeGreaterThan(0)
    }
  })
})

// =============================================================================

describe("noticeLabel", () => {
  it("says plainly that no notice is needed", () => {
    expect(noticeLabel(0)).toBe("Anytime, even now")
  })

  it("counts in hours below a day", () => {
    expect(noticeLabel(1)).toBe("1 hour ahead")
    expect(noticeLabel(12)).toBe("12 hours ahead")
  })

  it("counts in days from a day up", () => {
    expect(noticeLabel(24)).toBe("1 day ahead")
    expect(noticeLabel(48)).toBe("2 days ahead")
  })

  it("labels every preset", () => {
    for (const value of NOTICES) {
      expect(noticeLabel(value).length).toBeGreaterThan(0)
    }
  })
})

// =============================================================================

describe("withCurrent", () => {
  it("leaves the presets alone when the stored value is one of them", () => {
    expect(withCurrent(DURATIONS, 30)).toEqual(DURATIONS)
  })

  it("keeps a stored value that is not a preset, in its right place", () => {
    // Without this, a calendar saved at 20 minutes would open on a select with
    // no matching item — and the first save would silently move it.
    expect(withCurrent(DURATIONS, 20)).toEqual([15, 20, 30, 45, 60, 90])
    expect(withCurrent(BUFFERS, 45)).toEqual([0, 5, 10, 15, 30, 45])
    expect(withCurrent(NOTICES, 72)).toEqual([0, 1, 2, 4, 12, 24, 48, 72])
  })

  it("does not mutate the shared preset arrays", () => {
    const before = [...DURATIONS]
    withCurrent(DURATIONS, 20)
    expect(DURATIONS).toEqual(before)
  })
})

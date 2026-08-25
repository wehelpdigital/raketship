import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CalendarForm } from "./calendar-form"
import type { BookingCalendarRow } from "@/lib/supabase/types"

const actions = vi.hoisted(() => ({
  createCalendar: vi.fn(),
  updateCalendar: vi.fn(),
  deleteCalendar: vi.fn(),
}))
vi.mock("@/features/booking/actions", () => actions)

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function calendar(overrides: Partial<BookingCalendarRow> = {}): BookingCalendarRow {
  return {
    id: "cal-1",
    user_id: "user-1",
    name: "Gupit ni Nena",
    description: null,
    slug: "gupit-ni-nena",
    timezone: "Asia/Manila",
    country: "PH",
    duration_minutes: 30,
    buffer_minutes: 0,
    notice_hours: 2,
    cancel_notice_hours: 24,
    send_confirmation_email: true,
    send_reminder_email: true,
    booking_horizon_days: 14,
    length_mode: "fixed",
    is_published: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  actions.updateCalendar.mockResolvedValue({ ok: true })
  actions.createCalendar.mockResolvedValue({ ok: true, id: "cal-1" })
})

describe("saving the Details tab", () => {
  it("sends every setting the tab shows, not only some of them", async () => {
    // "Books up to" was rendered, bound to state, and silently left out of the
    // update — so the save reported success and the choice was dropped. This
    // is the only screen that edits it, so nothing else would have caught it.
    const user = userEvent.setup()
    render(<CalendarForm mode="edit" calendar={calendar()} />)

    await user.click(screen.getByRole("button", { name: /Save changes/ }))

    await waitFor(() => expect(actions.updateCalendar).toHaveBeenCalled())
    const sent = actions.updateCalendar.mock.calls[0][0]

    for (const key of [
      "calendarId",
      "name",
      "description",
      "bufferMinutes",
      "noticeHours",
      "cancelNoticeHours",
      "horizonDays",
    ]) {
      expect(sent, key).toHaveProperty(key)
    }
  })

  it("carries the stored values through untouched", async () => {
    const user = userEvent.setup()
    render(
      <CalendarForm
        mode="edit"
        calendar={calendar({
          booking_horizon_days: 90,
          cancel_notice_hours: 48,
          notice_hours: 4,
          buffer_minutes: 15,
        })}
      />
    )

    await user.click(screen.getByRole("button", { name: /Save changes/ }))

    await waitFor(() => expect(actions.updateCalendar).toHaveBeenCalled())
    expect(actions.updateCalendar.mock.calls[0][0]).toMatchObject({
      horizonDays: 90,
      cancelNoticeHours: 48,
      noticeHours: 4,
      bufferMinutes: 15,
    })
  })

  it("keeps the two notice settings apart", async () => {
    // They are adjacent selects with similar labels and the same units, which
    // is exactly how one ends up wired to the other's state.
    const user = userEvent.setup()
    render(
      <CalendarForm
        mode="edit"
        calendar={calendar({ notice_hours: 4, cancel_notice_hours: 48 })}
      />
    )

    await user.click(screen.getByRole("button", { name: /Save changes/ }))

    await waitFor(() => expect(actions.updateCalendar).toHaveBeenCalled())
    const sent = actions.updateCalendar.mock.calls[0][0]
    expect(sent.noticeHours).toBe(4)
    expect(sent.cancelNoticeHours).toBe(48)
  })

  it("sends the same set when creating", async () => {
    const user = userEvent.setup()
    render(<CalendarForm mode="create" />)

    await user.type(screen.getByLabelText("Booking name"), "Bagong raket")
    await user.click(screen.getByRole("button", { name: /Create calendar/ }))

    await waitFor(() => expect(actions.createCalendar).toHaveBeenCalled())
    const form = actions.createCalendar.mock.calls[0][0] as FormData
    for (const key of [
      "name",
      "bufferMinutes",
      "noticeHours",
      "cancelNoticeHours",
      "horizonDays",
    ]) {
      expect(form.get(key), key).not.toBeNull()
    }
  })
})

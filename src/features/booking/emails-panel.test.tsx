import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { BookingCalendarRow } from "@/lib/supabase/types"

import { EmailsPanel } from "./emails-panel"

const updateCalendar = vi.fn()

vi.mock("@/features/booking/actions", () => ({
  updateCalendar: (...args: unknown[]) => updateCalendar(...args),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function calendar(overrides: Partial<BookingCalendarRow> = {}): BookingCalendarRow {
  return {
    id: "cal-1",
    user_id: "u1",
    name: "Gupit ni Nena",
    description: null,
    slug: "gupit",
    timezone: "Asia/Manila",
    country: "PH",
    duration_minutes: 30,
    buffer_minutes: 0,
    notice_hours: 0,
    cancel_notice_hours: 24,
    send_confirmation_email: true,
    send_reminder_email: true,
    booking_horizon_days: 30,
    length_mode: "fixed",
    is_published: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as BookingCalendarRow
}

beforeEach(() => {
  updateCalendar.mockReset()
  updateCalendar.mockResolvedValue({ ok: true })
})

describe("EmailsPanel", () => {
  it("shows both switches, on by default", () => {
    render(<EmailsPanel calendar={calendar()} />)

    expect(screen.getByLabelText("Confirmation email")).toBeChecked()
    expect(screen.getByLabelText("Reminder email")).toBeChecked()
  })

  it("saves the moment a switch is flipped", async () => {
    const user = userEvent.setup()
    render(<EmailsPanel calendar={calendar()} />)

    await user.click(screen.getByLabelText("Reminder email"))

    await waitFor(() =>
      expect(updateCalendar).toHaveBeenCalledWith({
        calendarId: "cal-1",
        sendReminderEmail: false,
      })
    )
    expect(screen.getByLabelText("Reminder email")).not.toBeChecked()
    // The other switch was not dragged along.
    expect(screen.getByLabelText("Confirmation email")).toBeChecked()
  })

  it("flips back when the save fails, rather than lying", async () => {
    updateCalendar.mockResolvedValue({ ok: false, message: "Hindi na-save." })
    const user = userEvent.setup()
    render(<EmailsPanel calendar={calendar()} />)

    await user.click(screen.getByLabelText("Confirmation email"))

    await waitFor(() =>
      expect(screen.getByLabelText("Confirmation email")).toBeChecked()
    )
  })

  it("shows what the row actually holds", () => {
    render(
      <EmailsPanel
        calendar={calendar({ send_reminder_email: false })}
      />
    )
    expect(screen.getByLabelText("Reminder email")).not.toBeChecked()
    expect(screen.getByLabelText("Confirmation email")).toBeChecked()
  })

  it("reads a pre-migration row as the default, never as off", () => {
    const row = calendar()
    // A paste-provisioned project can lag the migration; the column is then
    // simply absent from the row.
    delete (row as Record<string, unknown>).send_confirmation_email
    delete (row as Record<string, unknown>).send_reminder_email

    render(<EmailsPanel calendar={row} />)
    expect(screen.getByLabelText("Confirmation email")).toBeChecked()
    expect(screen.getByLabelText("Reminder email")).toBeChecked()
  })
})

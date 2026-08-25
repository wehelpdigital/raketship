import type { ComponentProps } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { CalendarCard } from "@/features/booking/calendar-card"
import type { BookingCalendarRow } from "@/lib/supabase/types"

// next/link's useLinkStatus is a hook the shell's nav also reaches for, so the
// mock has to export it or every other nav render test breaks.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useLinkStatus: () => ({ pending: false }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

function makeCalendar(
  overrides: Partial<BookingCalendarRow> = {}
): BookingCalendarRow {
  return {
    id: "cal-1",
    user_id: "user-1",
    name: "Haircut with Aling Nena",
    description: "Wash, cut and blow-dry.",
    slug: "aling-nena-haircut",
    timezone: "Asia/Manila",
    country: "PH",
    duration_minutes: 30,
    buffer_minutes: 0,
    notice_hours: 2,
    cancel_notice_hours: 24,
    send_confirmation_email: true,
    send_reminder_email: true,
    reminder_24h: true,
    reminder_8h: false,
    reminder_15m: false,
    booking_horizon_days: 14,
    length_mode: "fixed" as const,
    is_published: false,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  }
}

const PUBLIC_URL = "https://raketship.ph/book/aling-nena-haircut"

describe("CalendarCard", () => {
  it("shows a published calendar with its link and a copy button", () => {
    render(
      <CalendarCard
        calendar={makeCalendar({ is_published: true })}
        bookingCount={3}
        publicUrl={PUBLIC_URL}
      />
    )

    expect(screen.getByText("Published")).toBeInTheDocument()
    expect(screen.queryByText("Draft")).toBeNull()

    // The protocol is noise on a card this narrow, so only the readable part
    // of the link is printed.
    expect(
      screen.getByText("raketship.ph/book/aling-nena-haircut")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "Copy the link for Haircut with Aling Nena",
      })
    ).toBeInTheDocument()
    expect(screen.queryByText(/Not shared yet/i)).toBeNull()
  })

  it("shows a draft with no link at all, and says how to get one", () => {
    render(
      <CalendarCard
        calendar={makeCalendar()}
        bookingCount={0}
        publicUrl={PUBLIC_URL}
      />
    )

    expect(screen.getByText("Draft")).toBeInTheDocument()
    expect(screen.queryByText("Published")).toBeNull()
    expect(screen.getByText(/Not shared yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/raketship\.ph/)).toBeNull()
    expect(screen.queryByRole("button", { name: /Copy the link/i })).toBeNull()
  })

  it("opens the editor for this calendar", () => {
    render(
      <CalendarCard
        calendar={makeCalendar()}
        bookingCount={0}
        publicUrl={PUBLIC_URL}
      />
    )

    expect(
      screen.getByRole("link", { name: "Haircut with Aling Nena" })
    ).toHaveAttribute("href", "/modules/booking/cal-1")
  })

  it("counts bookings, singular and plural and none", () => {
    const { unmount } = render(
      <CalendarCard
        calendar={makeCalendar()}
        bookingCount={1}
        publicUrl={PUBLIC_URL}
      />
    )
    expect(screen.getByText("1 booking")).toBeInTheDocument()
    unmount()

    render(
      <CalendarCard
        calendar={makeCalendar()}
        bookingCount={0}
        publicUrl={PUBLIC_URL}
      />
    )
    expect(screen.getByText("No bookings yet")).toBeInTheDocument()
  })

  it("does not print the weekly hours — that lives in the editor", () => {
    render(
      <CalendarCard
        calendar={makeCalendar()}
        bookingCount={0}
        publicUrl={PUBLIC_URL}
      />
    )
    expect(screen.queryByText(/9:00 AM/)).not.toBeInTheDocument()
    expect(screen.queryByText("No days set yet")).not.toBeInTheDocument()
  })

  it("renders a calendar with no description without crashing", () => {
    render(
      <CalendarCard
        calendar={makeCalendar({ description: null })}
        bookingCount={0}
        publicUrl={PUBLIC_URL}
      />
    )

    expect(screen.queryByText("Wash, cut and blow-dry.")).toBeNull()
    expect(screen.getByText("Haircut with Aling Nena")).toBeInTheDocument()
  })
})

describe("what the card says about length", () => {
  it("states the length when there is only one", () => {
    render(
      <CalendarCard
        calendar={makeCalendar({ duration_minutes: 90 })}
        bookingCount={0}
        publicUrl="https://raketship.ph/book/gupit"
      />
    )
    expect(screen.getByText(/1 hr 30 min per booking/)).toBeInTheDocument()
  })

  it("counts the services instead when there is a catalogue", () => {
    // Naming duration_minutes here would state a length nothing is booked at.
    render(
      <CalendarCard
        calendar={makeCalendar({ length_mode: "catalog", duration_minutes: 30 })}
        bookingCount={0}
        serviceCount={3}
        publicUrl="https://raketship.ph/book/gupit"
      />
    )
    expect(screen.getByText(/3 services/)).toBeInTheDocument()
    expect(screen.queryByText(/per booking/)).not.toBeInTheDocument()
  })

  it("counts one service without the plural", () => {
    render(
      <CalendarCard
        calendar={makeCalendar({ length_mode: "catalog" })}
        bookingCount={0}
        serviceCount={1}
        publicUrl="https://raketship.ph/book/gupit"
      />
    )
    expect(screen.getByText(/1 service ·/)).toBeInTheDocument()
  })

  it("falls back to the length when the catalogue is empty", () => {
    render(
      <CalendarCard
        calendar={makeCalendar({ length_mode: "catalog", duration_minutes: 45 })}
        bookingCount={0}
        serviceCount={0}
        publicUrl="https://raketship.ph/book/gupit"
      />
    )
    expect(screen.getByText(/45 min per booking/)).toBeInTheDocument()
  })
})

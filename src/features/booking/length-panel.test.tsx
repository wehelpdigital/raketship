import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LengthPanel } from "./length-panel"
import type {
  BookingCalendarRow,
  BookingServiceRow,
} from "@/lib/supabase/types"

const actions = vi.hoisted(() => ({
  setLengthMode: vi.fn(),
  saveService: vi.fn(),
  deleteService: vi.fn(),
  reorderServices: vi.fn(),
  updateCalendar: vi.fn(),
  createCalendar: vi.fn(),
  deleteCalendar: vi.fn(),
}))

vi.mock("@/features/booking/actions", () => actions)

const refresh = vi.hoisted(() => vi.fn())
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

function calendar(
  overrides: Partial<BookingCalendarRow> = {}
): BookingCalendarRow {
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

function service(overrides: Partial<BookingServiceRow> = {}): BookingServiceRow {
  return {
    id: "svc-1",
    calendar_id: "cal-1",
    user_id: "user-1",
    name: "Gupit lang",
    description: null,
    price_centavos: 15000,
    duration_minutes: 30,
    position: 0,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  actions.setLengthMode.mockResolvedValue({ ok: true })
  actions.saveService.mockResolvedValue({ ok: true })
  actions.deleteService.mockResolvedValue({ ok: true })
  actions.reorderServices.mockResolvedValue({ ok: true })
  actions.updateCalendar.mockResolvedValue({ ok: true })
})

describe("LengthPanel", () => {
  it("offers both ways of answering, not one at a time", () => {
    // Hiding the unselected half would make the catalogue unreachable from a
    // calendar that has none: you cannot switch to a list you may not build.
    render(<LengthPanel calendar={calendar()} services={[]} />)

    expect(
      screen.getByRole("radio", { name: /One length for everything/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("radio", { name: /A list of services/ })
    ).toBeInTheDocument()
  })

  it("marks the one actually in use", () => {
    render(<LengthPanel calendar={calendar()} services={[]} />)

    expect(
      screen.getByRole("radio", { name: /One length for everything/ })
    ).toHaveAttribute("aria-checked", "true")
    expect(
      screen.getByRole("radio", { name: /A list of services/ })
    ).toHaveAttribute("aria-checked", "false")
  })

  it("writes the length as words, not as a clock time", () => {
    render(
      <LengthPanel calendar={calendar({ duration_minutes: 90 })} services={[]} />
    )
    // "1:30" on a page full of clock times reads as half past one.
    expect(screen.getAllByText(/1 hr 30 min/).length).toBeGreaterThan(0)
  })

  it("will not switch to a catalogue that has nothing in it", async () => {
    const user = userEvent.setup()
    render(<LengthPanel calendar={calendar()} services={[]} />)

    const option = screen.getByRole("radio", { name: /A list of services/ })
    expect(option).toBeDisabled()
    expect(screen.getByText("Add a service below first.")).toBeInTheDocument()

    await user.click(option)
    expect(actions.setLengthMode).not.toHaveBeenCalled()
  })

  it("switches once there is something to switch to", async () => {
    const user = userEvent.setup()
    render(<LengthPanel calendar={calendar()} services={[service()]} />)

    await user.click(screen.getByRole("radio", { name: /A list of services/ }))

    expect(actions.setLengthMode).toHaveBeenCalledWith({
      calendarId: "cal-1",
      mode: "catalog",
    })
  })

  it("puts the mode back when the server refuses it", async () => {
    const user = userEvent.setup()
    actions.setLengthMode.mockResolvedValue({ ok: false, message: "Nope." })
    render(<LengthPanel calendar={calendar()} services={[service()]} />)

    const option = screen.getByRole("radio", { name: /A list of services/ })
    await user.click(option)

    await waitFor(() => {
      expect(option).toHaveAttribute("aria-checked", "false")
    })
  })

  it("picks a length in hours and minutes, minutes in tens", async () => {
    render(<LengthPanel calendar={calendar()} services={[]} />)

    expect(screen.getByLabelText("Hours")).toBeInTheDocument()
    expect(screen.getByLabelText("Minutes")).toBeInTheDocument()
  })

  it("only saves the length once it has actually changed", () => {
    render(<LengthPanel calendar={calendar()} services={[]} />)
    // Nothing has been touched, so there is nothing to save.
    expect(screen.getByRole("button", { name: "Save length" })).toBeDisabled()
  })

  it("shows what each service costs and how long it takes", () => {
    render(
      <LengthPanel
        calendar={calendar({ length_mode: "catalog" })}
        services={[
          service(),
          service({
            id: "svc-2",
            name: "Gupit at kulay",
            price_centavos: 90000,
            duration_minutes: 120,
          }),
        ]}
      />
    )

    // Scoped to the row: "30 min" also appears in the fixed-length readout
    // beside it, and a bare getByText cannot tell the two apart.
    const cheap = screen.getByText("Gupit lang").closest("li")
    expect(cheap).toHaveTextContent("₱150")
    expect(cheap).toHaveTextContent("30 min")

    const dear = screen.getByText("Gupit at kulay").closest("li")
    expect(dear).toHaveTextContent("₱900")
    expect(dear).toHaveTextContent("2 hrs")
  })

  it("says a free price is a question, not a giveaway", () => {
    render(
      <LengthPanel
        calendar={calendar()}
        services={[service({ price_centavos: 0 })]}
      />
    )
    expect(screen.getByText("Price on request")).toBeInTheDocument()
  })

  it("says plainly when there is nothing in the catalogue yet", () => {
    render(<LengthPanel calendar={calendar()} services={[]} />)
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument()
  })

  it("sends a new service with its price in centavos", async () => {
    const user = userEvent.setup()
    render(<LengthPanel calendar={calendar()} services={[]} />)

    await user.click(screen.getByRole("button", { name: /Add a service/ }))
    await user.type(await screen.findByLabelText("Service name"), "Manicure")
    await user.type(screen.getByLabelText("Price"), "350.50")
    await user.click(screen.getByRole("button", { name: "Add service" }))

    await waitFor(() => {
      expect(actions.saveService).toHaveBeenCalled()
    })
    expect(actions.saveService.mock.calls[0][0]).toMatchObject({
      calendarId: "cal-1",
      name: "Manicure",
      priceCentavos: 35050,
      durationMinutes: 30,
    })
  })

  it("refuses a price it cannot read rather than guessing one", async () => {
    const user = userEvent.setup()
    render(<LengthPanel calendar={calendar()} services={[]} />)

    await user.click(screen.getByRole("button", { name: /Add a service/ }))
    await user.type(await screen.findByLabelText("Service name"), "Manicure")
    await user.type(screen.getByLabelText("Price"), "tatlong daan")
    await user.click(screen.getByRole("button", { name: "Add service" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(/pesos/)
    expect(actions.saveService).not.toHaveBeenCalled()
  })

  it("treats a blank price as ask-me rather than zero pesos", async () => {
    const user = userEvent.setup()
    render(<LengthPanel calendar={calendar()} services={[]} />)

    await user.click(screen.getByRole("button", { name: /Add a service/ }))
    await user.type(await screen.findByLabelText("Service name"), "Konsultasyon")
    await user.click(screen.getByRole("button", { name: "Add service" }))

    await waitFor(() => {
      expect(actions.saveService).toHaveBeenCalled()
    })
    expect(actions.saveService.mock.calls[0][0].priceCentavos).toBe(0)
  })

  it("opens an existing service with its own values filled in", async () => {
    const user = userEvent.setup()
    render(
      <LengthPanel
        calendar={calendar()}
        services={[service({ name: "Gupit lang", price_centavos: 15000 })]}
      />
    )

    await user.click(screen.getByRole("button", { name: /Edit Gupit lang/ }))

    expect(await screen.findByLabelText("Service name")).toHaveValue("Gupit lang")
    expect(screen.getByLabelText("Price")).toHaveValue("150")
  })

  it("removes a service by its own id", async () => {
    const user = userEvent.setup()
    render(<LengthPanel calendar={calendar()} services={[service()]} />)

    await user.click(screen.getByRole("button", { name: /Remove Gupit lang/ }))

    await waitFor(() => {
      expect(actions.deleteService).toHaveBeenCalledWith("svc-1")
    })
  })

  it("does not offer to reorder a list of one", () => {
    render(<LengthPanel calendar={calendar()} services={[service()]} />)
    expect(
      screen.queryByRole("button", { name: /Move Gupit lang up/ })
    ).not.toBeInTheDocument()
  })

  it("sends the whole new order, not just the row that moved", async () => {
    const user = userEvent.setup()
    render(
      <LengthPanel
        calendar={calendar()}
        services={[
          service(),
          service({ id: "svc-2", name: "Kulay", position: 1 }),
        ]}
      />
    )

    await user.click(screen.getByRole("button", { name: /Move Kulay up/ }))

    await waitFor(() => {
      expect(actions.reorderServices).toHaveBeenCalledWith({
        calendarId: "cal-1",
        orderedIds: ["svc-2", "svc-1"],
      })
    })
  })
})

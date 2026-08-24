import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BookedBrowser } from "./booked-browser"
import type { BookedRow } from "./booked-list"

vi.mock("@/features/booking/actions", () => ({
  cancelBooking: vi.fn(),
  restoreBooking: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const CAL_A = "aaaaaaaa-1111-4111-8111-111111111111"
const CAL_B = "bbbbbbbb-2222-4222-8222-222222222222"

function row(index: number, overrides: Partial<BookedRow> = {}): BookedRow {
  const day = String(10 + (index % 20)).padStart(2, "0")
  return {
    id: `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`,
    calendarId: CAL_A,
    calendarName: "Gupit ni Nena",
    timezone: "Asia/Manila",
    startsAt: `2027-03-${day}T01:00:00.000Z`,
    endsAt: `2027-03-${day}T01:30:00.000Z`,
    status: "confirmed",
    customerName: `Suki ${index}`,
    customerEmail: `suki${index}@example.com`,
    customerPhone: "09171234567",
    serviceName: "Gupit lang",
    servicePriceCentavos: 15000,
    durationMinutes: 30,
    answers: {},
    createdAt: "2027-02-01T00:00:00.000Z",
    ...overrides,
  }
}

function renderBrowser(
  overrides: Partial<React.ComponentProps<typeof BookedBrowser>> = {}
) {
  return render(
    <BookedBrowser
      rows={[row(1), row(2), row(3)]}
      fieldsByCalendar={{}}
      calendars={[{ id: CAL_A, name: "Gupit ni Nena" }]}
      emptyLabel="Wala pa."
      {...overrides}
    />
  )
}

const search = () => screen.getByPlaceholderText(/Pangalan, number/)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("searching", () => {
  it("narrows to what was typed", async () => {
    const user = userEvent.setup()
    renderBrowser({
      rows: [
        row(1, { customerName: "Juan dela Cruz" }),
        row(2, { customerName: "Maria Santos" }),
      ],
    })

    await user.type(search(), "maria")

    expect(screen.getByText("Maria Santos")).toBeInTheDocument()
    expect(screen.queryByText("Juan dela Cruz")).not.toBeInTheDocument()
  })

  it("finds a booking by its reference", async () => {
    const user = userEvent.setup()
    renderBrowser({ rows: [row(1, { customerName: "Juan" }), row(2)] })

    // The eight characters the customer was shown on their confirmation.
    await user.type(search(), "00000001")

    expect(screen.getByText("Juan")).toBeInTheDocument()
    expect(screen.queryByText("Suki 2")).not.toBeInTheDocument()
  })

  it("says so when nothing matches, rather than showing an empty list", async () => {
    const user = userEvent.setup()
    renderBrowser()

    await user.type(search(), "walang ganito")

    expect(screen.getByText(/Walang booking na tugma/)).toBeInTheDocument()
  })

  it("clears from the box and from the summary", async () => {
    const user = userEvent.setup()
    renderBrowser()

    await user.type(search(), "maria")
    await user.click(screen.getByRole("button", { name: /Burahin/ }))

    expect(search()).toHaveValue("")
    expect(screen.getByText("Suki 1")).toBeInTheDocument()
  })

  it("reports how much of the list survived", async () => {
    const user = userEvent.setup()
    renderBrowser({
      rows: [
        row(1, { customerName: "Juan" }),
        row(2, { customerName: "Maria" }),
        row(3, { customerName: "Nena" }),
      ],
    })

    expect(screen.getByText("3 bookings")).toBeInTheDocument()
    // A digit would match every row here — they all share a phone number, and
    // the number is searchable on purpose.
    await user.type(search(), "maria")
    expect(screen.getByText("1 sa 3")).toBeInTheDocument()
  })
})

describe("filtering by calendar", () => {
  const twoCalendars = {
    rows: [
      row(1, { calendarId: CAL_A, calendarName: "Gupit" }),
      row(2, { calendarId: CAL_B, calendarName: "Kulay", customerName: "Maria" }),
    ],
    calendars: [
      { id: CAL_A, name: "Gupit" },
      { id: CAL_B, name: "Kulay" },
    ],
  }

  it("offers the filter only when there is more than one to pick", () => {
    renderBrowser()
    expect(screen.queryByLabelText(/ayon sa calendar/)).not.toBeInTheDocument()

    renderBrowser(twoCalendars)
    expect(screen.getByLabelText(/ayon sa calendar/)).toBeInTheDocument()
  })
})

describe("paging", () => {
  const many = Array.from({ length: 25 }, (_, i) => row(i + 1))

  it("shows one page at a time", () => {
    renderBrowser({ rows: many })

    // The default page size, not all twenty-five.
    expect(screen.getAllByRole("button", { expanded: false })).toHaveLength(10)
  })

  it("moves between pages", async () => {
    const user = userEvent.setup()
    renderBrowser({ rows: many })

    expect(screen.getByText("Suki 1")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Pahina 2" }))

    expect(screen.queryByText("Suki 1")).not.toBeInTheDocument()
    expect(screen.getByText("Suki 11")).toBeInTheDocument()
  })

  it("does not offer paging when it all fits", () => {
    renderBrowser()
    expect(screen.queryByRole("navigation", { name: /pahina/i })).not.toBeInTheDocument()
  })

  it("comes back to page one when a search shrinks the list", async () => {
    // Otherwise the results are on page one and you are still on page three,
    // looking at nothing.
    const user = userEvent.setup()
    renderBrowser({ rows: many })

    await user.click(screen.getByRole("button", { name: "Pahina 3" }))
    await user.type(search(), "Suki 2")

    expect(screen.getByText("Suki 2")).toBeInTheDocument()
  })

  it("changes how many fit on a page", async () => {
    const user = userEvent.setup()
    renderBrowser({ rows: many })

    await user.click(screen.getByLabelText(/Ilan bawat pahina/))
    await user.click(await screen.findByRole("option", { name: "50 / pahina" }))

    expect(screen.getAllByRole("button", { expanded: false })).toHaveLength(25)
  })
})

describe("opening a row", () => {
  it("starts closed, so the list can be scanned", () => {
    renderBrowser()
    for (const button of screen.getAllByRole("button", { expanded: false })) {
      expect(button).toHaveAttribute("aria-expanded", "false")
    }
  })

  it("opens to show the detail", async () => {
    const user = userEvent.setup()
    renderBrowser({ rows: [row(1, { customerEmail: "juan@example.com" })] })

    await user.click(screen.getByRole("button", { expanded: false }))

    // Written out plainly, so an owner reading it back on the phone reads a
    // line rather than a layout.
    expect(screen.getByText("Pangalan:")).toBeInTheDocument()
    // Twice on purpose: once in the row you scan, once labelled in the detail
    // you read back to the customer.
    expect(screen.getAllByText("Suki 1")).toHaveLength(2)
    expect(screen.getByText("Kailan:")).toBeInTheDocument()
    expect(screen.getByText("Reference:")).toBeInTheDocument()
    expect(screen.getByText("Email:")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /juan@example.com/ })).toBeInTheDocument()
  })

  it("keeps only one open at a time", async () => {
    // A list where every row is expanded is a list you cannot scan.
    const user = userEvent.setup()
    renderBrowser()

    const rows = () => screen.getAllByRole("button", { name: /Suki/ })
    await user.click(rows()[0])
    expect(screen.getAllByText("Reference:")).toHaveLength(1)

    await user.click(rows()[1])
    expect(screen.getAllByText("Reference:")).toHaveLength(1)
  })

  it("closes again when tapped a second time", async () => {
    const user = userEvent.setup()
    renderBrowser({ rows: [row(1)] })

    const control = screen.getByRole("button", { expanded: false })
    await user.click(control)
    expect(control).toHaveAttribute("aria-expanded", "true")

    await user.click(control)
    expect(control).toHaveAttribute("aria-expanded", "false")
  })

  it("shows the answers to the owner's own questions", async () => {
    const user = userEvent.setup()
    const field = {
      id: "f1",
      calendar_id: CAL_A,
      user_id: "u1",
      label: "Anong hairstyle",
      type: "short_text" as const,
      help: null,
      placeholder: null,
      required: false,
      options: [],
      position: 0,
      created_at: "2027-01-01T00:00:00.000Z",
      updated_at: "2027-01-01T00:00:00.000Z",
    }
    renderBrowser({
      rows: [row(1, { answers: { f1: "Fade po" } })],
      fieldsByCalendar: { [CAL_A]: [field] },
    })

    await user.click(screen.getByRole("button", { expanded: false }))

    // The owner's own questions read the same way as everything else.
    expect(screen.getByText("Anong hairstyle:")).toBeInTheDocument()
    expect(screen.getByText("Fade po")).toBeInTheDocument()
  })
})

describe("an empty list", () => {
  it("says what the tab means rather than that a search failed", () => {
    renderBrowser({ rows: [], emptyLabel: "Wala pang natapos na booking." })
    expect(screen.getByText("Wala pang natapos na booking.")).toBeInTheDocument()
  })
})

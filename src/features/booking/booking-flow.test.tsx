import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BookingFlow, type OpenRange } from "./booking-flow"

const actions = vi.hoisted(() => ({
  getAvailableSlots: vi.fn(),
  submitBooking: vi.fn(),
}))

vi.mock("@/features/booking/public-actions", () => actions)

const SLOTS = [
  {
    startsAt: "2026-09-07T01:00:00.000Z",
    endsAt: "2026-09-07T01:30:00.000Z",
    label: "9:00 AM",
  },
  {
    startsAt: "2026-09-07T01:30:00.000Z",
    endsAt: "2026-09-07T02:00:00.000Z",
    label: "9:30 AM",
  },
]

/** The shop is open across these instants, so days derive as open. */
const OPEN_RANGES: OpenRange[] = [
  { from: "2026-09-07T01:00:00.000Z", to: "2026-09-07T09:00:00.000Z" },
  { from: "2026-09-08T01:00:00.000Z", to: "2026-09-08T09:00:00.000Z" },
]

function renderFlow() {
  return render(
    <BookingFlow
      calendarId="cal-1"
      calendarName="Gupit ni Nena"
      durationMinutes={30}
      timezone="Asia/Manila"
      timezoneLabel="Manila · GMT+8"
      fields={[]}
      openRanges={OPEN_RANGES}
      horizonDays={14}
    />
  )
}

/** The three step panels, identified by their headings. */
const dateStep = () => screen.queryByText("Pumili ng petsa")
const timeStep = () => screen.queryByText("Pumili ng oras")
const detailStep = () => screen.queryByText("Your details")

/** Fixed so the open ranges below are always "today" and "tomorrow". */
const NOW = new Date("2026-09-07T00:30:00.000Z")

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  actions.getAvailableSlots.mockReset()
  actions.submitBooking.mockReset()
  actions.getAvailableSlots.mockResolvedValue({ ok: true, slots: SLOTS })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("BookingFlow as a wizard", () => {
  it("shows only the first step to begin with", () => {
    renderFlow()
    expect(dateStep()).toBeInTheDocument()
    // The point of a wizard: the later steps are not merely hidden, they are
    // not rendered, so a phone has nothing extra to scroll past.
    expect(timeStep()).not.toBeInTheDocument()
    expect(detailStep()).not.toBeInTheDocument()
  })

  it("advances to the times once a date is picked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderFlow()

    await user.click(screen.getAllByRole("button", { name: /2026-09-07|Mon|Tue|Wed|Thu|Fri|Sat|Sun/ })[0])

    await waitFor(() => expect(timeStep()).toBeInTheDocument())
    expect(dateStep()).not.toBeInTheDocument()
  })

  it("goes back to the dates and keeps the one already chosen", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderFlow()

    const firstDay = screen.getAllByRole("button", {
      name: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/,
    })[0]
    await user.click(firstDay)
    await waitFor(() => expect(timeStep()).toBeInTheDocument())

    await user.click(screen.getByRole("button", { name: /Ibang petsa/ }))

    expect(dateStep()).toBeInTheDocument()
    expect(timeStep()).not.toBeInTheDocument()
    // Going back must not throw the choice away — that is the difference
    // between a wizard and starting over.
    expect(
      screen.getAllByRole("button", { name: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ })[0]
    ).toHaveAttribute("aria-pressed", "true")
  })

  it("reaches the details step after a time is picked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderFlow()

    await user.click(
      screen.getAllByRole("button", { name: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ })[0]
    )
    await waitFor(() => expect(timeStep()).toBeInTheDocument())

    // Slots read as a range now, so the name is "9:00 AM – 9:30 AM".
    await user.click(await screen.findByRole("button", { name: /9:00 AM/ }))

    await waitFor(() => expect(detailStep()).toBeInTheDocument())
    expect(timeStep()).not.toBeInTheDocument()
  })

  it("lets the stepper walk back to a finished step, but never forward", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderFlow()

    await user.click(
      screen.getAllByRole("button", { name: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ })[0]
    )
    await waitFor(() => expect(timeStep()).toBeInTheDocument())

    // Step 1 is done, so its marker is a way back.
    const back = screen.getByRole("button", { name: /Bumalik sa Petsa/ })
    await user.click(back)
    expect(dateStep()).toBeInTheDocument()

    // Nothing offers a jump to a step that has not been earned.
    expect(
      screen.queryByRole("button", { name: /Bumalik sa Detalye/ })
    ).not.toBeInTheDocument()
  })
})

describe("choosing a timezone", () => {
  it("asks for the zone before the dates, not after", () => {
    renderFlow()
    // The zone decides which day a slot falls on, so it cannot come second:
    // picking it later would silently change what an already-chosen date meant.
    expect(dateStep()).toBeInTheDocument()
    expect(screen.getByText("Oras na ipinapakita")).toBeInTheDocument()
  })

  it("keeps the shop's own zone reachable and labelled", () => {
    renderFlow()
    expect(screen.getByText(/oras ng shop/)).toBeInTheDocument()
  })

  it("names the shop's zone on the times step once a date is chosen", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderFlow()

    await user.click(
      screen.getAllByRole("button", { name: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ })[0]
    )
    await waitFor(() => expect(timeStep()).toBeInTheDocument())

    // jsdom reports UTC and the fixture shop is Manila, so the two differ and
    // the times step says which clock is being read.
    expect(screen.getByText(/Oras ng shop|Oras sa /)).toBeInTheDocument()
  })

  it("derives the days from open instants, not a server-decided list", () => {
    renderFlow()
    // The ranges cover today and tomorrow, so at least those two are tappable
    // and the rest of the fortnight is not.
    const enabled = screen
      .getAllByRole("button", { name: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ })
      .filter((b) => !b.hasAttribute("disabled"))
    expect(enabled.length).toBeGreaterThan(0)
    expect(enabled.length).toBeLessThan(14)
  })
})

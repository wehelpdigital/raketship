import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BookingFlow, type BookingDay } from "./booking-flow"

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

/** Two open days so a date is always tappable. */
const DAYS: BookingDay[] = [
  { iso: "2026-09-07", open: true },
  { iso: "2026-09-08", open: true },
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
      days={DAYS}
    />
  )
}

/** The three step panels, identified by their headings. */
const dateStep = () => screen.queryByText("Pumili ng petsa")
const timeStep = () => screen.queryByText("Pumili ng oras")
const detailStep = () => screen.queryByText("Your details")

beforeEach(() => {
  actions.getAvailableSlots.mockReset()
  actions.submitBooking.mockReset()
  actions.getAvailableSlots.mockResolvedValue({ ok: true, slots: SLOTS })
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
    const user = userEvent.setup()
    renderFlow()

    await user.click(screen.getAllByRole("button", { name: /2026-09-07|Mon|Tue|Wed|Thu|Fri|Sat|Sun/ })[0])

    await waitFor(() => expect(timeStep()).toBeInTheDocument())
    expect(dateStep()).not.toBeInTheDocument()
  })

  it("goes back to the dates and keeps the one already chosen", async () => {
    const user = userEvent.setup()
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
    const user = userEvent.setup()
    renderFlow()

    await user.click(
      screen.getAllByRole("button", { name: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ })[0]
    )
    await waitFor(() => expect(timeStep()).toBeInTheDocument())

    await user.click(await screen.findByRole("button", { name: "9:00 AM" }))

    await waitFor(() => expect(detailStep()).toBeInTheDocument())
    expect(timeStep()).not.toBeInTheDocument()
  })

  it("lets the stepper walk back to a finished step, but never forward", async () => {
    const user = userEvent.setup()
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

describe("reading times in your own timezone", () => {
  async function reachTheTimes(user: ReturnType<typeof userEvent.setup>) {
    renderFlow()
    await user.click(
      screen.getAllByRole("button", { name: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ })[0]
    )
    await waitFor(() =>
      expect(screen.queryByText("Pumili ng oras")).toBeInTheDocument()
    )
  }

  it("shows the shop's own clock until told otherwise", async () => {
    const user = userEvent.setup()
    await reachTheTimes(user)

    // vitest.setup stubs matchMedia and jsdom reports UTC, so the viewer's zone
    // never differs here — the calendar's own times stand.
    expect(await screen.findByRole("button", { name: /9:00 AM/ })).toBeInTheDocument()
  })

  it("offers a way to change which zone the times are read in", async () => {
    const user = userEvent.setup()
    await reachTheTimes(user)

    expect(screen.getByText("Oras na ipinapakita")).toBeInTheDocument()
    // The shop's own zone is always in reach, so whose clock is whose stays clear.
    expect(screen.getByText(/oras ng shop/)).toBeInTheDocument()
  })

  it("names the shop's timezone alongside the times", async () => {
    const user = userEvent.setup()
    await reachTheTimes(user)

    expect(screen.getByText(/Manila · GMT\+8/)).toBeInTheDocument()
  })
})

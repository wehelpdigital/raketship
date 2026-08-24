import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  BookingFlow,
  type OpenRange,
  type PublicService,
} from "./booking-flow"

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

/*
  A stub challenge. Four bits so the browser solves it in a handful of hashes —
  the real sixteen would make every test in this file wait on real work, and
  what the field does with the answer is what these cases are about.
*/
const CHALLENGE = {
  nonce: "a".repeat(32),
  issuedAt: 1_800_000_000_000,
  signature: "b".repeat(64),
}

const SERVICES: PublicService[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Gupit lang",
    description: null,
    priceCentavos: 15000,
    durationMinutes: 30,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Gupit at kulay",
    description: "Kasama ang shampoo.",
    priceCentavos: 90000,
    durationMinutes: 120,
  },
]

function renderFlow(
  overrides: Partial<React.ComponentProps<typeof BookingFlow>> = {}
) {
  return render(
    <BookingFlow
      calendarId="cal-1"
      calendarName="Gupit ni Nena"
      durationMinutes={30}
      lengthMode="fixed"
      services={[]}
      timezone="Asia/Manila"
      timezoneLabel="Manila · GMT+8"
      fields={[]}
      openRanges={OPEN_RANGES}
      horizonDays={14}
      challenge={CHALLENGE}
      challengeBits={4}
      {...overrides}
    />
  )
}

/** The same flow, but selling a catalogue. */
function renderCatalog(
  overrides: Partial<React.ComponentProps<typeof BookingFlow>> = {}
) {
  return renderFlow({ lengthMode: "catalog", services: SERVICES, ...overrides })
}

/** The step panels, identified by their headings. */
const serviceStep = () => screen.queryByText("Anong serbisyo?")
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
    expect(
      screen.getByRole("button", { name: /Ang iyong timezone/ })
    ).toBeInTheDocument()
  })

  it("shows the chosen zone on the tag itself", () => {
    renderFlow()
    // What is inside the picker's dialog is its own file's business; here it
    // only matters that the flow surfaces the current zone.
    const tag = screen.getByRole("button", { name: /Ang iyong timezone/ })
    expect(tag).toHaveTextContent("Manila")
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

// -----------------------------------------------------------------------------
// Selling a catalogue: the service comes first, because it is the length
// -----------------------------------------------------------------------------

describe("BookingFlow with a service catalogue", () => {
  it("asks what they are booking before it asks when", async () => {
    renderCatalog()

    expect(serviceStep()).toBeInTheDocument()
    expect(dateStep()).not.toBeInTheDocument()
    // Four steps now, and the first one names what it is for.
    expect(screen.getByText("Serbisyo")).toBeInTheDocument()
  })

  it("shows the price and the length on each row", async () => {
    renderCatalog()

    expect(screen.getByText("Gupit lang")).toBeInTheDocument()
    expect(screen.getByText("₱150")).toBeInTheDocument()
    expect(screen.getByText("30 min")).toBeInTheDocument()
    expect(screen.getByText("₱900")).toBeInTheDocument()
    expect(screen.getByText("2 hrs")).toBeInTheDocument()
  })

  it("moves on to the dates once a service is picked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCatalog()

    await user.click(screen.getByRole("button", { name: /Gupit lang/ }))

    expect(dateStep()).toBeInTheDocument()
    expect(serviceStep()).not.toBeInTheDocument()
  })

  it("asks the server for that service's times, not the calendar's", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderCatalog()

    await user.click(screen.getByRole("button", { name: /Gupit at kulay/ }))
    await user.click(screen.getAllByRole("button", { name: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ })[0])

    await waitFor(() => {
      expect(actions.getAvailableSlots).toHaveBeenCalled()
    })
    const sent = actions.getAvailableSlots.mock.calls.at(-1)![0]
    expect(sent.serviceId).toBe(SERVICES[1].id)
  })

  it("fetches nothing until a service is chosen", () => {
    renderCatalog()
    // There is no length yet, so there is nothing to ask for.
    expect(actions.getAvailableSlots).not.toHaveBeenCalled()
  })

  it("still starts at the date when there is no catalogue", () => {
    renderFlow()
    expect(serviceStep()).not.toBeInTheDocument()
    expect(dateStep()).toBeInTheDocument()
  })

  it("falls back to the date step when the catalogue is empty", () => {
    // The owner switched to a catalogue and removed every service. Stranding
    // the customer on a step with nothing to tap would be worse than the
    // calendar's own length.
    renderFlow({ lengthMode: "catalog", services: [] })
    expect(serviceStep()).not.toBeInTheDocument()
    expect(dateStep()).toBeInTheDocument()
  })

  it("sends the zone the dates were cut in", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderFlow()

    await user.click(screen.getAllByRole("button", { name: /Mon|Tue|Wed|Thu|Fri|Sat|Sun/ })[0])

    await waitFor(() => {
      expect(actions.getAvailableSlots).toHaveBeenCalled()
    })
    // Without this the server reads the date as one of the SHOP's days and
    // hands back a different day's times to anyone in another zone.
    const sent = actions.getAvailableSlots.mock.calls.at(-1)![0]
    expect(sent.viewerZone).toBe("Asia/Manila")
  })
})

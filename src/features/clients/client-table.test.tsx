import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import type { ClientRecord } from "@/lib/clients/derive"

import { ClientTable } from "./client-table"

function client(overrides: Partial<ClientRecord> = {}): ClientRecord {
  return {
    key: `email:${overrides.email ?? "maria@example.com"}`,
    name: "Maria Santos",
    email: "maria@example.com",
    phone: "09171234567",
    bookings: 3,
    cancelled: 1,
    totalCentavos: 45000,
    firstAt: "2026-01-10T01:00:00.000Z",
    lastAt: "2026-03-10T01:00:00.000Z",
    calendars: ["Gupit"],
    answers: [{ label: "Anong gupit", value: "Fade po" }],
    ...overrides,
  }
}

describe("ClientTable", () => {
  it("shows a formal header for the columns, and one row per person", () => {
    render(
      <ClientTable
        clients={[client(), client({ key: "n2", name: "Juan", email: "juan@x.com" })]}
        calendars={["Gupit"]}
      />
    )

    expect(screen.getByText("Huling booking")).toBeInTheDocument()
    expect(screen.getByText("Maria Santos")).toBeInTheDocument()
    expect(screen.getByText("Juan")).toBeInTheDocument()
    expect(screen.getByText("2 clients")).toBeInTheDocument()
  })

  it("opens a person to everything they ever said", async () => {
    const user = userEvent.setup()
    render(<ClientTable clients={[client()]} calendars={["Gupit"]} />)

    await user.click(screen.getByRole("button", { name: /Maria Santos/ }))

    // The owner's own question is the column — the shape adapts to the form.
    expect(screen.getByText("Anong gupit:")).toBeInTheDocument()
    expect(screen.getByText("Fade po")).toBeInTheDocument()
    expect(screen.getByText("Sagot sa form mo")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /maria@example.com/ })).toBeInTheDocument()
  })

  it("searches across names, numbers and answers", async () => {
    const user = userEvent.setup()
    render(
      <ClientTable
        clients={[
          client(),
          client({ key: "n2", name: "Juan", email: "juan@x.com", phone: null, answers: [] }),
        ]}
        calendars={["Gupit"]}
      />
    )

    await user.type(screen.getByPlaceholderText(/Pangalan, number/), "fade")

    expect(screen.getByText("Maria Santos")).toBeInTheDocument()
    expect(screen.queryByText("Juan")).not.toBeInTheDocument()
    expect(screen.getByText("1 sa 2")).toBeInTheDocument()
  })

  it("filters by calendar only when there is more than one", () => {
    render(<ClientTable clients={[client()]} calendars={["Gupit"]} />)
    expect(screen.queryByLabelText(/ayon sa calendar/)).not.toBeInTheDocument()

    render(
      <ClientTable
        clients={[
          client(),
          client({ key: "n2", name: "Juan", email: "j@x.com", calendars: ["Kulay"] }),
        ]}
        calendars={["Gupit", "Kulay"]}
      />
    )
    expect(screen.getByLabelText(/ayon sa calendar/)).toBeInTheDocument()
  })

  it("grows rather than paginating", async () => {
    const user = userEvent.setup()
    const many = Array.from({ length: 30 }, (_, i) =>
      client({ key: `k${i}`, name: `Suki ${i}`, email: `s${i}@x.com` })
    )
    render(<ClientTable clients={many} calendars={["Gupit"]} />)

    expect(screen.getAllByRole("button", { name: /Suki/ })).toHaveLength(20)
    await user.click(screen.getByRole("button", { name: /Marami pang client/ }))
    expect(screen.getAllByRole("button", { name: /Suki/ })).toHaveLength(30)
  })

  it("says what the empty page means, not that a search failed", () => {
    render(<ClientTable clients={[]} calendars={[]} />)
    expect(screen.getByText("Wala pang client")).toBeInTheDocument()
  })
})

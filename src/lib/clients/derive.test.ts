import { describe, expect, it } from "vitest"

import type { BookingFormFieldRow } from "@/lib/supabase/types"
import type { OwnerBooking } from "@/lib/queries/booking"

import { clientMatches, deriveClients, identityOf } from "./derive"

const CAL = "cal-1"

function booking(overrides: Partial<OwnerBooking> = {}): OwnerBooking {
  return {
    id: "b1",
    calendar_id: CAL,
    user_id: "u1",
    service_id: null,
    starts_at: "2026-03-10T01:00:00.000Z",
    ends_at: "2026-03-10T01:30:00.000Z",
    customer_name: "Maria Santos",
    customer_email: "maria@example.com",
    customer_phone: "0917 123 4567",
    service_name: null,
    service_price_centavos: null,
    answers: {},
    status: "confirmed",
    created_at: "2026-03-01T00:00:00.000Z",
    updated_at: "2026-03-01T00:00:00.000Z",
    calendar: { name: "Gupit" } as OwnerBooking["calendar"],
    ...overrides,
  } as OwnerBooking
}

function field(id: string, label: string): BookingFormFieldRow {
  return {
    id,
    calendar_id: CAL,
    user_id: "u1",
    label,
    type: "short_text",
    help: null,
    placeholder: null,
    required: false,
    options: [],
    position: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  } as BookingFormFieldRow
}

describe("identityOf", () => {
  it("trusts the email first, case-blind", () => {
    expect(
      identityOf({ customer_email: "Maria@Example.com ", customer_phone: "0917", customer_name: "X" })
    ).toBe("email:maria@example.com")
  })

  it("falls back to the phone's digits, however it was typed", () => {
    for (const phone of ["0917 123 4567", "0917-123-4567", "09171234567"]) {
      expect(
        identityOf({ customer_email: null, customer_phone: phone, customer_name: "X" })
      ).toBe("phone:09171234567")
    }
  })

  it("uses the name only when there is nothing better", () => {
    expect(
      identityOf({ customer_email: null, customer_phone: null, customer_name: " Maria Santos " })
    ).toBe("name:maria santos")
  })
})

describe("deriveClients", () => {
  it("folds one person's bookings into one client", () => {
    const clients = deriveClients(
      [
        booking({ id: "b1", starts_at: "2026-03-10T01:00:00.000Z" }),
        booking({ id: "b2", starts_at: "2026-04-02T01:00:00.000Z", created_at: "2026-03-20T00:00:00.000Z" }),
      ],
      {}
    )

    expect(clients).toHaveLength(1)
    expect(clients[0].bookings).toBe(2)
    expect(clients[0].firstAt).toBe("2026-03-10T01:00:00.000Z")
    expect(clients[0].lastAt).toBe("2026-04-02T01:00:00.000Z")
  })

  it("keeps two people apart even when one detail matches", () => {
    const clients = deriveClients(
      [
        booking({ id: "b1" }),
        booking({ id: "b2", customer_email: "juan@example.com", customer_name: "Juan" }),
      ],
      {}
    )
    expect(clients).toHaveLength(2)
  })

  it("lets the latest booking correct the person's details", () => {
    const clients = deriveClients(
      [
        booking({ id: "b1", customer_name: "Ma. Santos", created_at: "2026-03-01T00:00:00.000Z" }),
        booking({ id: "b2", customer_name: "Maria Santos", created_at: "2026-03-15T00:00:00.000Z" }),
      ],
      {}
    )
    expect(clients[0].name).toBe("Maria Santos")
  })

  it("counts money only on bookings that still stand", () => {
    const clients = deriveClients(
      [
        booking({ id: "b1", service_price_centavos: 15000 }),
        booking({ id: "b2", service_price_centavos: 20000, status: "cancelled" }),
      ],
      {}
    )
    expect(clients[0].totalCentavos).toBe(15000)
    expect(clients[0].bookings).toBe(1)
    expect(clients[0].cancelled).toBe(1)
  })

  it("adapts its columns to whatever the owner asked", () => {
    const clients = deriveClients(
      [
        booking({ id: "b1", answers: { f1: "Fade po", f2: "" } }),
        booking({
          id: "b2",
          created_at: "2026-03-15T00:00:00.000Z",
          answers: { f1: "Undercut na", f3: "Cash" },
        }),
      ],
      { [CAL]: [field("f1", "Anong gupit"), field("f2", "Allergy"), field("f3", "Bayad")] }
    )

    const answers = Object.fromEntries(
      clients[0].answers.map((a) => [a.label, a.value])
    )
    // The latest answer wins; an unanswered question never becomes a column.
    expect(answers["Anong gupit"]).toBe("Undercut na")
    expect(answers["Bayad"]).toBe("Cash")
    expect(answers["Allergy"]).toBeUndefined()
  })

  it("never lets an empty answer blank out a real one", () => {
    const clients = deriveClients(
      [
        booking({ id: "b1", answers: { f1: "Fade po" } }),
        booking({ id: "b2", created_at: "2026-03-15T00:00:00.000Z", answers: { f1: "" } }),
      ],
      { [CAL]: [field("f1", "Anong gupit")] }
    )
    expect(clients[0].answers[0]?.value).toBe("Fade po")
  })

  it("puts the most recently seen client first", () => {
    const clients = deriveClients(
      [
        booking({ id: "b1", customer_email: "a@x.com", starts_at: "2026-03-01T01:00:00.000Z" }),
        booking({ id: "b2", customer_email: "b@x.com", starts_at: "2026-05-01T01:00:00.000Z" }),
      ],
      {}
    )
    expect(clients[0].email).toBe("b@x.com")
  })
})

describe("clientMatches", () => {
  const client = deriveClients(
    [booking({ answers: { f1: "Fade po" } })],
    { [CAL]: [field("f1", "Anong gupit")] }
  )[0]

  it("finds a person the way they are searched for", () => {
    expect(clientMatches(client, "maria")).toBe(true)
    expect(clientMatches(client, "0917 123")).toBe(true)
    expect(clientMatches(client, "09171234567")).toBe(true)
    expect(clientMatches(client, "fade")).toBe(true)
    expect(clientMatches(client, "gupit")).toBe(true)
    expect(clientMatches(client, "wala")).toBe(false)
  })

  it("narrows with every word", () => {
    expect(clientMatches(client, "maria fade")).toBe(true)
    expect(clientMatches(client, "maria wala")).toBe(false)
  })
})

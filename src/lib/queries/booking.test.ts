import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The query module is server-only, which throws the moment jsdom imports it.
// Stubbed away so the logic underneath can be tested at all.
vi.mock("server-only", () => ({}))

import { listBookedForOwner } from "./booking"

const mocks = vi.hoisted(() => ({ getSupabaseServerClient: vi.fn() }))

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
  getCurrentUser: vi.fn(),
}))

/** A PostgREST-shaped stub: every filter chains, the terminal call resolves. */
function makeQuery(data: unknown) {
  const query: Record<string, unknown> = {}
  const chain = () => query
  Object.assign(query, {
    select: chain,
    eq: chain,
    order: chain,
    limit: () => Promise.resolve({ data, error: null }),
    then: (onfulfilled: (value: { data: unknown }) => unknown) =>
      Promise.resolve({ data, error: null }).then(onfulfilled),
  })
  return query
}

const OWNER = "11111111-1111-4111-8111-111111111111"
const CAL = "22222222-2222-4222-8222-222222222222"

/** Pinned so "upcoming" and "past" mean the same thing on every run. */
const NOW = new Date("2027-03-01T12:00:00.000Z")

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    calendar_id: CAL,
    user_id: OWNER,
    starts_at: "2027-03-02T01:00:00.000Z",
    ends_at: "2027-03-02T01:30:00.000Z",
    customer_name: "Juan dela Cruz",
    customer_email: "juan@example.com",
    customer_phone: null,
    answers: {},
    status: "confirmed",
    service_id: null,
    service_name: null,
    service_price_centavos: null,
    created_at: "2027-02-01T00:00:00.000Z",
    calendar: { id: CAL, name: "Gupit", timezone: "Asia/Manila" },
    ...overrides,
  }
}

function stub(bookings: unknown[], fields: unknown[] = []) {
  mocks.getSupabaseServerClient.mockResolvedValue({
    from: (table: string) =>
      makeQuery(table === "bookings" ? bookings : fields),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("listBookedForOwner", () => {
  it("returns empty rather than throwing when there is no database", async () => {
    mocks.getSupabaseServerClient.mockResolvedValue(null)
    const result = await listBookedForOwner(OWNER)
    expect(result).toEqual({
      upcoming: [],
      past: [],
      cancelled: [],
      fieldsByCalendar: {},
    })
  })

  it("splits confirmed bookings around now", async () => {
    stub([
      booking({ id: "later", starts_at: "2027-03-05T01:00:00.000Z", ends_at: "2027-03-05T01:30:00.000Z" }),
      booking({ id: "earlier", starts_at: "2027-02-01T01:00:00.000Z", ends_at: "2027-02-01T01:30:00.000Z" }),
    ])

    const { upcoming, past } = await listBookedForOwner(OWNER)
    expect(upcoming.map((b) => b.id)).toEqual(["later"])
    expect(past.map((b) => b.id)).toEqual(["earlier"])
  })

  it("counts a booking in progress as upcoming, not history", async () => {
    // Judged on when it ENDS: the customer is in the chair right now.
    stub([
      booking({
        id: "running",
        starts_at: "2027-03-01T11:45:00.000Z",
        ends_at: "2027-03-01T12:15:00.000Z",
      }),
    ])

    const { upcoming, past } = await listBookedForOwner(OWNER)
    expect(upcoming.map((b) => b.id)).toEqual(["running"])
    expect(past).toEqual([])
  })

  it("puts cancelled rows in their own list whenever they were", async () => {
    stub([
      booking({ id: "old-cancel", status: "cancelled", starts_at: "2027-01-01T01:00:00.000Z", ends_at: "2027-01-01T01:30:00.000Z" }),
      booking({ id: "future-cancel", status: "cancelled" }),
    ])

    const { upcoming, past, cancelled } = await listBookedForOwner(OWNER)
    expect(cancelled.map((b) => b.id).sort()).toEqual([
      "future-cancel",
      "old-cancel",
    ])
    // A cancelled booking is not a commitment, so it is in neither.
    expect(upcoming).toEqual([])
    expect(past).toEqual([])
  })

  it("orders upcoming soonest first and past most recent first", async () => {
    stub([
      booking({ id: "u2", starts_at: "2027-03-09T01:00:00.000Z", ends_at: "2027-03-09T01:30:00.000Z" }),
      booking({ id: "u1", starts_at: "2027-03-03T01:00:00.000Z", ends_at: "2027-03-03T01:30:00.000Z" }),
      booking({ id: "p1", starts_at: "2027-02-20T01:00:00.000Z", ends_at: "2027-02-20T01:30:00.000Z" }),
      booking({ id: "p2", starts_at: "2027-02-10T01:00:00.000Z", ends_at: "2027-02-10T01:30:00.000Z" }),
    ])

    const { upcoming, past } = await listBookedForOwner(OWNER)
    // What is next matters most; what is over reads newest first.
    expect(upcoming.map((b) => b.id)).toEqual(["u1", "u2"])
    expect(past.map((b) => b.id)).toEqual(["p1", "p2"])
  })

  it("groups the questions by calendar so answers can be labelled", async () => {
    stub(
      [booking()],
      [
        { id: "f1", calendar_id: CAL, label: "Anong serbisyo", position: 0 },
        { id: "f2", calendar_id: "other", label: "Iba", position: 0 },
      ]
    )

    const { fieldsByCalendar } = await listBookedForOwner(OWNER)
    expect(fieldsByCalendar[CAL].map((f) => f.label)).toEqual(["Anong serbisyo"])
    expect(fieldsByCalendar.other.map((f) => f.label)).toEqual(["Iba"])
  })

  it("uses one clock for the whole split", async () => {
    // Reading the time per row would let a booking landing exactly on now
    // appear in both lists or in neither.
    stub([
      booking({ id: "exactly-now", starts_at: "2027-03-01T11:30:00.000Z", ends_at: NOW.toISOString() }),
    ])

    const { upcoming, past } = await listBookedForOwner(OWNER)
    expect(upcoming.length + past.length).toBe(1)
  })
})

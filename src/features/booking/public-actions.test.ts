import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getAvailableSlots, submitBooking } from "./public-actions"

const mocks = vi.hoisted(() => ({
  getSupabaseServerClient: vi.fn(),
  getTakenSlots: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
  getCurrentUser: vi.fn(),
}))

vi.mock("@/lib/queries/booking", () => ({
  getTakenSlots: mocks.getTakenSlots,
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}))

// -----------------------------------------------------------------------------
// A PostgREST-shaped stub: every filter chains, the terminal call resolves.
// Filters are deliberately NOT applied, so a test can hand back a row the real
// query would have excluded and prove the action rejects it on its own.
//
// The builder is thenable, like the real one: an insert with no `.select()`
// is awaited directly rather than through a terminal method.
// -----------------------------------------------------------------------------

interface QueryResult {
  data: unknown
  error: { code?: string; message?: string } | null
}

interface Query extends PromiseLike<QueryResult> {
  select: (columns?: string) => Query
  eq: (column: string, value: unknown) => Query
  insert: (row: unknown) => Query
  order: (column: string, options?: unknown) => Promise<QueryResult>
  maybeSingle: () => Promise<QueryResult>
}

function makeQuery(
  result: QueryResult,
  onInsert?: (row: unknown) => void
): Query {
  const query: Query = {
    select: () => query,
    eq: () => query,
    insert: (row) => {
      onInsert?.(row)
      return query
    },
    order: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (onfulfilled, onrejected) =>
      Promise.resolve(result).then(onfulfilled, onrejected),
  }
  return query
}

const CALENDAR_ID = "11111111-1111-4111-8111-111111111111"
const FIELD_ID = "22222222-2222-4222-8222-222222222222"
const OWNER_ID = "33333333-3333-4333-8333-333333333333"

// 2027-03-01 is a Monday. The clock is pinned to the Wednesday before it, so
// the notice window and the booking horizon behave the same on every run and
// in every year — a suite that quietly starts failing on a date is not a suite.
const NOW = new Date("2027-02-24T00:00:00.000Z")
const MONDAY = "2027-03-01"
/** 09:00 in Asia/Manila (UTC+8, no daylight saving). */
const NINE_AM = "2027-03-01T01:00:00.000Z"
/** 13:00 in Asia/Manila — a real instant, but outside the 9–10am window. */
const ONE_PM = "2027-03-01T05:00:00.000Z"

function calendarRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CALENDAR_ID,
    user_id: OWNER_ID,
    name: "Aling Nena — Gupit",
    description: "Walk-in style, by appointment.",
    slug: "aling-nena-gupit",
    timezone: "Asia/Manila",
    country: "PH",
    duration_minutes: 30,
    buffer_minutes: 0,
    notice_hours: 2,
    booking_horizon_days: 60,
    is_published: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

/** Mondays, 9:00–10:00 — two 30-minute slots. */
const MONDAY_MORNING = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    calendar_id: CALENDAR_ID,
    user_id: OWNER_ID,
    weekday: 1,
    start_minute: 540,
    end_minute: 600,
    created_at: "2026-01-01T00:00:00.000Z",
  },
]

function requiredChoiceField() {
  return {
    id: FIELD_ID,
    calendar_id: CALENDAR_ID,
    user_id: OWNER_ID,
    label: "Anong serbisyo",
    type: "select",
    help: null,
    placeholder: null,
    required: true,
    options: ["Gupit", "Kulay"],
    position: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  }
}

interface ClientOptions {
  calendar?: unknown
  availability?: unknown[]
  blackouts?: unknown[]
  fields?: unknown[]
  insertResult?: QueryResult
}

function stubClient(options: ClientOptions = {}) {
  const insert = vi.fn()
  const from = vi.fn((table: string): Query => {
    switch (table) {
      case "booking_calendars":
        return makeQuery({
          data: "calendar" in options ? options.calendar : calendarRow(),
          error: null,
        })
      case "booking_availability":
        return makeQuery({ data: options.availability ?? MONDAY_MORNING, error: null })
      case "booking_blackouts":
        return makeQuery({ data: options.blackouts ?? [], error: null })
      case "booking_form_fields":
        return makeQuery({ data: options.fields ?? [], error: null })
      case "bookings":
        return makeQuery(
          options.insertResult ?? { data: { id: "booking-1" }, error: null },
          insert
        )
      default:
        return makeQuery({ data: null, error: null })
    }
  })

  mocks.getSupabaseServerClient.mockResolvedValue({ from })
  return { from, insert }
}

function validSubmission(overrides: Record<string, unknown> = {}) {
  return {
    calendarId: CALENDAR_ID,
    startsAt: NINE_AM,
    customerName: "Juan dela Cruz",
    customerEmail: "juan@example.com",
    customerPhone: "",
    answers: {},
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Only Date is faked: nothing here waits on a timer, and leaving setTimeout
  // alone keeps promises resolving normally.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  mocks.getTakenSlots.mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

// -----------------------------------------------------------------------------

describe("getAvailableSlots", () => {
  it("refuses an unpublished calendar", async () => {
    stubClient({ calendar: calendarRow({ is_published: false }) })

    const result = await getAvailableSlots({
      calendarId: CALENDAR_ID,
      isoDate: MONDAY,
    })

    expect(result.ok).toBe(false)
    expect(result.slots).toEqual([])
    expect(result.message).toMatch(/not taking bookings/i)
  })

  it("refuses a calendar that does not exist", async () => {
    stubClient({ calendar: null })

    const result = await getAvailableSlots({
      calendarId: CALENDAR_ID,
      isoDate: MONDAY,
    })

    expect(result.ok).toBe(false)
    expect(result.slots).toEqual([])
  })

  it("offers the calendar's own hours, labelled in its timezone", async () => {
    stubClient()

    const result = await getAvailableSlots({
      calendarId: CALENDAR_ID,
      isoDate: MONDAY,
    })

    expect(result.ok).toBe(true)
    expect(result.timezone).toBe("Asia/Manila")
    expect(result.slots.map((s) => s.startsAt)).toEqual([
      NINE_AM,
      "2027-03-01T01:30:00.000Z",
    ])
    expect(result.slots[0]?.label).toBe("9:00 AM")
  })

  it("distinguishes a fully booked day from a closed one", async () => {
    stubClient()
    mocks.getTakenSlots.mockResolvedValue([
      { startsAt: NINE_AM, endsAt: "2027-03-01T01:30:00.000Z" },
      {
        startsAt: "2027-03-01T01:30:00.000Z",
        endsAt: "2027-03-01T02:00:00.000Z",
      },
    ])

    const result = await getAvailableSlots({
      calendarId: CALENDAR_ID,
      isoDate: MONDAY,
    })

    expect(result.ok).toBe(true)
    expect(result.slots).toEqual([])
    expect(result.reason).toBe("full")
  })

  it("calls a day with no weekly rule closed", async () => {
    stubClient()

    // 2027-03-02 is a Tuesday; the calendar only opens on Mondays.
    const result = await getAvailableSlots({
      calendarId: CALENDAR_ID,
      isoDate: "2027-03-02",
    })

    expect(result.ok).toBe(true)
    expect(result.slots).toEqual([])
    expect(result.reason).toBe("closed")
  })

  /**
   * An open day with nothing left is usually just the day being over. Saying
   * "fully booked" there tells the customer their suki is swamped when in fact
   * the shop has closed for the evening — and anonymous visitors cannot read
   * `bookings` at all, so it is the reading they would get almost every time.
   */
  it("calls a day that has simply run out of hours passed, not full", async () => {
    stubClient()
    // 10:00 in Manila on the Monday: the 9–10am window is behind us.
    vi.setSystemTime(new Date("2027-03-01T02:00:00.000Z"))

    const result = await getAvailableSlots({
      calendarId: CALENDAR_ID,
      isoDate: MONDAY,
    })

    expect(result.ok).toBe(true)
    expect(result.slots).toEqual([])
    expect(result.reason).toBe("passed")
  })

  it("refuses a date past the booking horizon", async () => {
    stubClient()

    const result = await getAvailableSlots({
      calendarId: CALENDAR_ID,
      isoDate: "2029-03-05",
    })

    expect(result.ok).toBe(false)
    expect(result.slots).toEqual([])
    expect(result.message).toMatch(/not open for booking/i)
  })

  it("refuses a date that has already gone", async () => {
    stubClient()

    const result = await getAvailableSlots({
      calendarId: CALENDAR_ID,
      isoDate: "2026-03-02",
    })

    expect(result.ok).toBe(false)
    expect(result.slots).toEqual([])
  })

  it("says a blacked-out day is closed rather than merely empty", async () => {
    stubClient({
      blackouts: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          calendar_id: CALENDAR_ID,
          user_id: OWNER_ID,
          date: MONDAY,
          reason: "Fiesta",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    })

    const result = await getAvailableSlots({
      calendarId: CALENDAR_ID,
      isoDate: MONDAY,
    })

    expect(result.ok).toBe(true)
    expect(result.slots).toEqual([])
    expect(result.reason).toBe("blacked_out")
  })
})

describe("submitBooking", () => {
  it("refuses an unpublished calendar", async () => {
    const { insert } = stubClient({
      calendar: calendarRow({ is_published: false }),
    })

    const result = await submitBooking(validSubmission())

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/not taking bookings/i)
    expect(insert).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("refuses a startsAt that is not an offered slot", async () => {
    const { insert } = stubClient()

    const result = await submitBooking(validSubmission({ startsAt: ONE_PM }))

    expect(result.ok).toBe(false)
    expect(result.retry).toBe(true)
    expect(result.message).toMatch(/no longer available/i)
    expect(insert).not.toHaveBeenCalled()
  })

  it("refuses to book years into the future", async () => {
    const { insert } = stubClient()

    const result = await submitBooking(
      // A Monday 9am in Manila, but two years out — plausible to buildSlots,
      // which is exactly why the horizon is checked separately.
      validSubmission({ startsAt: "2029-03-05T01:00:00.000Z" })
    )

    expect(result.ok).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })

  it("rejects a submission missing a required answer", async () => {
    const { insert } = stubClient({ fields: [requiredChoiceField()] })

    const result = await submitBooking(validSubmission({ answers: {} }))

    expect(result.ok).toBe(false)
    expect(result.fieldErrors?.[FIELD_ID]).toMatch(/required/i)
    expect(insert).not.toHaveBeenCalled()
  })

  it("rejects an answer that is not one of the offered choices", async () => {
    const { insert } = stubClient({ fields: [requiredChoiceField()] })

    const result = await submitBooking(
      validSubmission({ answers: { [FIELD_ID]: "Massage" } })
    )

    expect(result.ok).toBe(false)
    expect(result.fieldErrors?.[FIELD_ID]).toBeTruthy()
    expect(insert).not.toHaveBeenCalled()
  })

  it("insists on some way to reach the customer", async () => {
    const { insert } = stubClient()

    const result = await submitBooking(
      validSubmission({ customerEmail: "", customerPhone: "" })
    )

    expect(result.ok).toBe(false)
    expect(result.fieldErrors?.contact).toBeTruthy()
    expect(insert).not.toHaveBeenCalled()
  })

  it("stores the booking against the calendar's owner, not the caller", async () => {
    const { insert } = stubClient({ fields: [requiredChoiceField()] })

    const result = await submitBooking(
      validSubmission({ answers: { [FIELD_ID]: "Gupit" } })
    )

    expect(result.ok).toBe(true)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        calendar_id: CALENDAR_ID,
        user_id: OWNER_ID,
        starts_at: NINE_AM,
        ends_at: "2027-03-01T01:30:00.000Z",
        customer_name: "Juan dela Cruz",
        status: "confirmed",
      })
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/book/aling-nena-gupit")
  })

  /**
   * Anonymous callers may insert into `bookings` but may not select from it —
   * the only read policy is the owner's. So the row must go in without a
   * RETURNING clause, which means the id has to be minted before the write.
   */
  it("mints the id itself instead of reading the row back", async () => {
    const { insert } = stubClient()

    const result = await submitBooking(validSubmission())
    const row = insert.mock.calls[0]?.[0] as { id: string }

    expect(result.ok).toBe(true)
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(result.bookingId).toBe(row.id)
  })

  it("drops answers to questions this calendar never asked", async () => {
    const { insert } = stubClient({ fields: [requiredChoiceField()] })

    await submitBooking(
      validSubmission({
        answers: {
          [FIELD_ID]: "Gupit",
          "99999999-9999-4999-8999-999999999999": "smuggled",
        },
      })
    )

    const row = insert.mock.calls[0]?.[0] as { answers: Record<string, unknown> }
    expect(Object.keys(row.answers)).toEqual([FIELD_ID])
  })

  it("turns a double-booking collision into plain advice", async () => {
    stubClient({
      insertResult: { data: null, error: { code: "23505" } },
    })

    const result = await submitBooking(validSubmission())

    expect(result.ok).toBe(false)
    expect(result.retry).toBe(true)
    expect(result.message).toMatch(/someone just took/i)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("does not fall over when Supabase is unconfigured", async () => {
    mocks.getSupabaseServerClient.mockResolvedValue(null)

    const result = await submitBooking(validSubmission())

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/not connected/i)
  })
})

describe("the booking horizon", () => {
  // NOW is 2027-02-24; MONDAY is 2027-03-01, five days out.
  it("offers a date inside the calendar's own horizon", async () => {
    stubClient({ calendar: calendarRow({ booking_horizon_days: 14 }) })

    const result = await getAvailableSlots({
      calendarId: CALENDAR_ID,
      isoDate: MONDAY,
    })

    expect(result.ok).toBe(true)
    expect(result.slots.length).toBeGreaterThan(0)
  })

  it("refuses the same date once the horizon is shortened past it", async () => {
    // Three days ahead only, so the Monday five days out is now out of reach.
    stubClient({ calendar: calendarRow({ booking_horizon_days: 3 }) })

    const result = await getAvailableSlots({
      calendarId: CALENDAR_ID,
      isoDate: MONDAY,
    })

    // The page would not offer it, but the action is what a script would hit.
    expect(result.slots).toEqual([])
  })

  it("counts today as day one, so a horizon of 1 means today only", async () => {
    stubClient({ calendar: calendarRow({ booking_horizon_days: 1 }) })

    const tomorrow = "2027-02-25"
    const result = await getAvailableSlots({
      calendarId: CALENDAR_ID,
      isoDate: tomorrow,
    })

    expect(result.slots).toEqual([])
  })

  it("caps a calendar that somehow holds an absurd horizon", async () => {
    // The check constraint blocks this, so it can only arrive from a row that
    // predates the column — the action still must not honour it.
    stubClient({ calendar: calendarRow({ booking_horizon_days: 99_999 }) })

    const farFuture = "2032-03-01"
    const result = await getAvailableSlots({
      calendarId: CALENDAR_ID,
      isoDate: farFuture,
    })

    expect(result.slots).toEqual([])
  })

  it("still refuses a date already past, whatever the horizon", async () => {
    stubClient({ calendar: calendarRow({ booking_horizon_days: 365 }) })

    const result = await getAvailableSlots({
      calendarId: CALENDAR_ID,
      isoDate: "2027-02-01",
    })

    expect(result.slots).toEqual([])
  })
})

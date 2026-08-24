import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  addBlackout,
  createCalendar,
  deleteCalendar,
  reorderFields,
  saveField,
  setAvailability,
  setPublished,
  updateCalendar,
  updateSlug,
} from "./actions"

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  getCurrentUser: mocks.getCurrentUser,
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}))

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

// -----------------------------------------------------------------------------
// A stand-in for the PostgREST builder
// -----------------------------------------------------------------------------

interface Reply {
  data?: unknown
  error?: { code?: string; message?: string } | null
}

interface Recorded {
  table: string
  op: "select" | "insert" | "update" | "delete"
  payload?: unknown
  filters: Array<[string, unknown]>
}

interface Chain {
  select: () => Chain
  insert: (payload: unknown) => Chain
  update: (patch: unknown) => Chain
  delete: () => Chain
  eq: (column: string, value: unknown) => Chain
  order: () => Chain
  limit: () => Chain
  maybeSingle: () => Chain
  then: (
    resolve: (result: { data: unknown; error: unknown }) => unknown
  ) => Promise<unknown>
}

/**
 * Chainable, thenable, and it records what every statement filtered on — which
 * is the only way to assert the thing that actually matters here: that no write
 * leaves without its user_id.
 *
 * `replies` is a queue per table, drained in call order.
 */
function stubClient(
  replies: Record<string, Reply[]> = {},
  rpcData: unknown = true
) {
  const recorded: Recorded[] = []
  const queues = new Map<string, Reply[]>(
    Object.entries(replies).map(([table, rows]) => [table, [...rows]])
  )
  const rpc = vi.fn(async () => ({ data: rpcData, error: null }))

  function from(table: string): Chain {
    const entry: Recorded = { table, op: "select", filters: [] }
    recorded.push(entry)

    const chain: Chain = {
      select: () => chain,
      insert: (payload) => {
        entry.op = "insert"
        entry.payload = payload
        return chain
      },
      update: (patch) => {
        entry.op = "update"
        entry.payload = patch
        return chain
      },
      delete: () => {
        entry.op = "delete"
        return chain
      },
      eq: (column, value) => {
        entry.filters.push([column, value])
        return chain
      },
      order: () => chain,
      limit: () => chain,
      maybeSingle: () => chain,
      then: (resolve) => {
        const queue = queues.get(table)
        const reply = queue && queue.length > 0 ? queue.shift() : undefined
        return Promise.resolve({
          data: reply?.data ?? null,
          error: reply?.error ?? null,
        }).then(resolve)
      },
    }

    return chain
  }

  mocks.getSupabaseServerClient.mockResolvedValue({ from, rpc })

  return {
    recorded,
    rpc,
    writes: () => recorded.filter((entry) => entry.op !== "select"),
    firstWrite: () => recorded.find((entry) => entry.op !== "select"),
    ofType: (op: Recorded["op"]) => recorded.filter((e) => e.op === op),
  }
}

function filterValue(entry: Recorded | undefined, column: string) {
  return entry?.filters.find(([name]) => name === column)?.[1]
}

const CALENDAR = {
  id: "cal-1",
  user_id: "user-1",
  name: "Haircut with Aling Nena",
  description: null,
  slug: "haircut-with-aling-nena",
  timezone: "Asia/Manila",
  country: "PH",
  duration_minutes: 30,
  buffer_minutes: 0,
  notice_hours: 2,
  is_published: false,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
}

function calendarForm(fields: Record<string, string> = {}) {
  const data = new FormData()
  data.set("name", "Haircut with Aling Nena")
  data.set("description", "Wash, cut and blow-dry.")
  data.set("durationMinutes", "30")
  data.set("bufferMinutes", "0")
  data.set("noticeHours", "2")
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getCurrentUser.mockResolvedValue({ id: "user-1" })
})

// =============================================================================

describe("signing in is re-checked on every action", () => {
  it("refuses every write when nobody is signed in", async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const results = await Promise.all([
      createCalendar(calendarForm()),
      updateCalendar({ calendarId: "cal-1", name: "New name" }),
      deleteCalendar("cal-1"),
      setPublished({ calendarId: "cal-1", published: true }),
      updateSlug({ calendarId: "cal-1", slug: "aling-nena" }),
      setAvailability({
        calendarId: "cal-1",
        rules: [{ weekday: 1, startMinute: 540, endMinute: 1020 }],
      }),
      addBlackout({ calendarId: "cal-1", date: "2026-12-25" }),
      saveField({
        calendarId: "cal-1",
        label: "Mobile number",
        type: "phone",
        required: true,
        options: [],
      }),
      reorderFields({ calendarId: "cal-1", orderedIds: ["f-1"] }),
    ])

    for (const result of results) {
      expect(result.ok).toBe(false)
      expect(result.message).toMatch(/sign in/i)
    }
    // Nothing even reached for a database client, let alone wrote.
    expect(mocks.getSupabaseServerClient).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("says so plainly when Supabase is not connected", async () => {
    mocks.getSupabaseServerClient.mockResolvedValue(null)

    const result = await createCalendar(calendarForm())

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/not connected/i)
  })

  it("scopes a calendar read by user_id as well as by id", async () => {
    const db = stubClient({ booking_calendars: [{ data: null }] })

    const result = await updateCalendar({ calendarId: "cal-1", name: "Nena" })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/could not find/i)
    expect(filterValue(db.recorded[0], "user_id")).toBe("user-1")
    expect(db.writes()).toHaveLength(0)
  })
})

// =============================================================================

describe("createCalendar", () => {
  it("derives a free slug from the name and files it under the session's user", async () => {
    const db = stubClient({
      booking_calendars: [
        { data: [{ slug: "haircut-with-aling-nena" }] },
        { data: { id: "cal-9" } },
      ],
    })

    const result = await createCalendar(calendarForm())

    expect(result.ok).toBe(true)
    expect(result.id).toBe("cal-9")

    const write = db.firstWrite()
    expect(write?.op).toBe("insert")
    expect(write?.payload).toMatchObject({
      user_id: "user-1",
      name: "Haircut with Aling Nena",
      // The plain slug is already taken by this user, so it steps aside.
      slug: "haircut-with-aling-nena-2",
      duration_minutes: 30,
      is_published: false,
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/modules/booking")
  })

  it("rejects a name that is too short before touching the database", async () => {
    const db = stubClient()

    const result = await createCalendar(calendarForm({ name: "A" }))

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/at least 2 characters/i)
    expect(db.recorded).toHaveLength(0)
  })

  it("refuses a hand-typed slug that breaks the rules", async () => {
    const db = stubClient()

    const result = await createCalendar(calendarForm({ slug: "Aling Nena!" }))

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/lowercase letters/i)
    expect(db.writes()).toHaveLength(0)
  })

  it("refuses a reserved word as a slug", async () => {
    stubClient()

    const result = await createCalendar(calendarForm({ slug: "admin" }))

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/reserved/i)
  })

  it("turns a unique-violation into plain words instead of leaking Postgres", async () => {
    stubClient({
      booking_calendars: [
        { data: [] },
        { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "booking_calendars_slug_key"' } },
      ],
    })

    const result = await createCalendar(calendarForm())

    expect(result.ok).toBe(false)
    expect(result.message).toBe("That link is taken. Try another one.")
    expect(result.message).not.toMatch(/constraint|duplicate key/i)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
})

// =============================================================================

describe("updateSlug", () => {
  it("rejects a slug that is too short", async () => {
    const db = stubClient({ booking_calendars: [{ data: CALENDAR }] })

    const result = await updateSlug({ calendarId: "cal-1", slug: "ab" })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/at least 3 characters/i)
    expect(db.writes()).toHaveLength(0)
  })

  it("rejects spaces and capitals with the rule, not a database error", async () => {
    stubClient({ booking_calendars: [{ data: CALENDAR }] })

    const result = await updateSlug({ calendarId: "cal-1", slug: "Book Me" })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/lowercase letters, numbers and single dashes/i)
  })

  it("rejects a reserved word", async () => {
    stubClient({ booking_calendars: [{ data: CALENDAR }] })

    const result = await updateSlug({ calendarId: "cal-1", slug: "marketplace" })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/reserved/i)
  })

  it("says the link is taken when the RPC reports it is not free", async () => {
    const db = stubClient({ booking_calendars: [{ data: CALENDAR }] }, false)

    const result = await updateSlug({ calendarId: "cal-1", slug: "aling-nena" })

    expect(db.rpc).toHaveBeenCalledWith("booking_slug_available", {
      p_slug: "aling-nena",
    })
    expect(result.ok).toBe(false)
    expect(result.message).toBe("That link is taken. Try another one.")
    expect(db.writes()).toHaveLength(0)
  })

  it("saves a free slug lowercased, scoped to the owner", async () => {
    const db = stubClient({
      booking_calendars: [{ data: CALENDAR }, { data: null }],
    })

    const result = await updateSlug({
      calendarId: "cal-1",
      slug: "  Aling-Nena  ",
    })

    expect(result.ok).toBe(true)
    const write = db.firstWrite()
    expect(write?.payload).toEqual({ slug: "aling-nena" })
    expect(filterValue(write, "id")).toBe("cal-1")
    expect(filterValue(write, "user_id")).toBe("user-1")
  })

  it("treats re-saving the same slug as a no-op", async () => {
    const db = stubClient({ booking_calendars: [{ data: CALENDAR }] })

    const result = await updateSlug({
      calendarId: "cal-1",
      slug: "haircut-with-aling-nena",
    })

    expect(result.ok).toBe(true)
    expect(db.writes()).toHaveLength(0)
  })
})

// =============================================================================

describe("setAvailability", () => {
  it("rejects a range that ends when it starts", async () => {
    const db = stubClient({ booking_calendars: [{ data: CALENDAR }] })

    const result = await setAvailability({
      calendarId: "cal-1",
      rules: [{ weekday: 2, startMinute: 540, endMinute: 540 }],
    })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/Tuesday/)
    expect(result.message).toMatch(/later than its start time/i)
    expect(db.writes()).toHaveLength(0)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("rejects a range that ends before it starts", async () => {
    const db = stubClient({ booking_calendars: [{ data: CALENDAR }] })

    const result = await setAvailability({
      calendarId: "cal-1",
      rules: [
        { weekday: 1, startMinute: 540, endMinute: 1020 },
        { weekday: 0, startMinute: 1020, endMinute: 540 },
      ],
    })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/Sunday/)
    // One bad range means nothing is written, so a half-saved week is
    // impossible.
    expect(db.writes()).toHaveLength(0)
  })

  it("rejects a weekday outside 0-6", async () => {
    const db = stubClient({ booking_calendars: [{ data: CALENDAR }] })

    const result = await setAvailability({
      calendarId: "cal-1",
      rules: [{ weekday: 7, startMinute: 540, endMinute: 1020 }],
    })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/day of the week/i)
    expect(db.writes()).toHaveLength(0)
  })

  it("replaces the whole week, stamping every row with the owner", async () => {
    const db = stubClient({
      booking_calendars: [{ data: CALENDAR }],
      booking_availability: [{ data: null }, { data: null }],
    })

    const result = await setAvailability({
      calendarId: "cal-1",
      rules: [
        { weekday: 1, startMinute: 540, endMinute: 720 },
        { weekday: 1, startMinute: 780, endMinute: 1020 },
        // A duplicate the editor sent twice; it should not reach the table.
        { weekday: 1, startMinute: 540, endMinute: 720 },
      ],
    })

    expect(result.ok).toBe(true)

    const [clear, insert] = db.writes()
    expect(clear.op).toBe("delete")
    expect(filterValue(clear, "calendar_id")).toBe("cal-1")
    expect(filterValue(clear, "user_id")).toBe("user-1")

    expect(insert.op).toBe("insert")
    expect(insert.payload).toEqual([
      {
        calendar_id: "cal-1",
        user_id: "user-1",
        weekday: 1,
        start_minute: 540,
        end_minute: 720,
      },
      {
        calendar_id: "cal-1",
        user_id: "user-1",
        weekday: 1,
        start_minute: 780,
        end_minute: 1020,
      },
    ])
  })

  it("clears the week without an insert when given no rules", async () => {
    const db = stubClient({
      booking_calendars: [{ data: CALENDAR }],
      booking_availability: [{ data: null }],
    })

    const result = await setAvailability({ calendarId: "cal-1", rules: [] })

    expect(result.ok).toBe(true)
    expect(db.ofType("insert")).toHaveLength(0)
    expect(db.ofType("delete")).toHaveLength(1)
  })
})

// =============================================================================

describe("setPublished", () => {
  it("will not publish a calendar with no hours set", async () => {
    const db = stubClient({
      booking_calendars: [{ data: CALENDAR }],
      booking_availability: [{ data: [] }],
    })

    const result = await setPublished({ calendarId: "cal-1", published: true })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/at least one day and time/i)
    expect(db.writes()).toHaveLength(0)
  })

  it("publishes once there is at least one window", async () => {
    const db = stubClient({
      booking_calendars: [{ data: CALENDAR }, { data: null }],
      booking_availability: [{ data: [{ id: "av-1" }] }],
    })

    const result = await setPublished({ calendarId: "cal-1", published: true })

    expect(result.ok).toBe(true)
    expect(db.firstWrite()?.payload).toEqual({ is_published: true })
    expect(filterValue(db.firstWrite(), "user_id")).toBe("user-1")
  })
})

// =============================================================================

describe("saveField", () => {
  it("refuses a question type that is not in the registry", async () => {
    const db = stubClient({ booking_calendars: [{ data: CALENDAR }] })

    const result = await saveField({
      calendarId: "cal-1",
      label: "Anything",
      type: "sql_injection",
      required: false,
      options: [],
    })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/do not know that kind/i)
    expect(db.writes()).toHaveLength(0)
  })

  it("asks for at least one choice on a multiple-choice question", async () => {
    stubClient({ booking_calendars: [{ data: CALENDAR }] })

    const result = await saveField({
      calendarId: "cal-1",
      label: "Which service?",
      type: "select",
      required: true,
      options: ["   ", ""],
    })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/at least one choice/i)
  })

  it("adds a question at the end, trimming and de-duplicating its choices", async () => {
    const db = stubClient({
      booking_calendars: [{ data: CALENDAR }],
      booking_form_fields: [{ data: { position: 2 } }, { data: { id: "f-9" } }],
    })

    const result = await saveField({
      calendarId: "cal-1",
      label: "Which service?",
      type: "select",
      required: true,
      options: [" Gupit ", "Gupit", "Kulot"],
    })

    expect(result.ok).toBe(true)
    expect(result.id).toBe("f-9")
    expect(db.firstWrite()?.payload).toMatchObject({
      calendar_id: "cal-1",
      user_id: "user-1",
      position: 3,
      type: "select",
      options: ["Gupit", "Kulot"],
    })
  })
})

// =============================================================================

describe("addBlackout", () => {
  it("refuses a date that does not exist", async () => {
    const db = stubClient({ booking_calendars: [{ data: CALENDAR }] })

    const result = await addBlackout({
      calendarId: "cal-1",
      date: "2026-02-31",
    })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/does not exist/i)
    expect(db.recorded).toHaveLength(0)
  })

  it("treats a repeated date as already handled rather than an error", async () => {
    stubClient({
      booking_calendars: [{ data: CALENDAR }],
      booking_blackouts: [{ data: null, error: { code: "23505" } }],
    })

    const result = await addBlackout({
      calendarId: "cal-1",
      date: "2026-12-25",
      reason: "Pasko",
    })

    expect(result.ok).toBe(true)
    expect(result.message).toMatch(/already closed/i)
  })
})

// =============================================================================

describe("reorderFields", () => {
  it("ignores ids that do not belong to this calendar", async () => {
    const db = stubClient({
      booking_calendars: [{ data: CALENDAR }],
      booking_form_fields: [
        { data: [{ id: "f-1" }, { id: "f-2" }] },
        { data: null },
        { data: null },
      ],
    })

    const result = await reorderFields({
      calendarId: "cal-1",
      orderedIds: ["f-2", "someone-elses-field", "f-1"],
    })

    expect(result.ok).toBe(true)
    const updates = db.ofType("update")
    expect(updates).toHaveLength(2)
    expect(updates[0].payload).toEqual({ position: 0 })
    expect(filterValue(updates[0], "id")).toBe("f-2")
    expect(updates[1].payload).toEqual({ position: 1 })
    expect(filterValue(updates[1], "id")).toBe("f-1")
    for (const update of updates) {
      expect(filterValue(update, "user_id")).toBe("user-1")
    }
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"
import { revalidatePath } from "next/cache"

import {
  activateModule,
  changePlan,
  deactivateModule,
  setModuleTier,
} from "@/features/marketplace/actions"
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({
  getCurrentUser: vi.fn(),
  getSupabaseServerClient: vi.fn(),
}))

type Row = Record<string, unknown>

interface Call {
  table: string
  op: "select" | "insert" | "update" | "delete"
  filters: Record<string, unknown>
  payload?: Row
}

interface Builder {
  select(columns?: string): Builder
  insert(payload: Row): Builder
  update(payload: Row): Builder
  delete(): Builder
  eq(column: string, value: unknown): Builder
  order(column: string, options?: { ascending?: boolean }): Builder
  limit(count: number): Builder
  maybeSingle(): Promise<{ data: Row | null; error: null }>
  then(
    onFulfilled: (value: { data: Row[] | null; error: null }) => unknown
  ): Promise<unknown>
}

/** A tiny in-memory stand-in for the PostgREST builder we actually call. */
function createStub(seed: Record<string, Row[]>) {
  const writes: Call[] = []

  function from(table: string): Builder {
    const call: Call = { table, op: "select", filters: {} }
    let orderColumn: string | null = null
    let ascending = true
    let take: number | null = null

    const rows = (): Row[] => {
      let result = (seed[table] ?? []).filter((row) =>
        Object.entries(call.filters).every(([key, value]) => row[key] === value)
      )
      if (orderColumn !== null) {
        const column = orderColumn
        result = [...result].sort((a, b) => {
          const left = Number(a[column] ?? 0)
          const right = Number(b[column] ?? 0)
          return ascending ? left - right : right - left
        })
      }
      if (take !== null) result = result.slice(0, take)
      return result
    }

    const builder: Builder = {
      select: () => builder,
      insert: (payload) => {
        call.op = "insert"
        call.payload = payload
        return builder
      },
      update: (payload) => {
        call.op = "update"
        call.payload = payload
        return builder
      },
      delete: () => {
        call.op = "delete"
        return builder
      },
      eq: (column, value) => {
        call.filters[column] = value
        return builder
      },
      order: (column, options) => {
        orderColumn = column
        ascending = options?.ascending ?? true
        return builder
      },
      limit: (count) => {
        take = count
        return builder
      },
      maybeSingle: () => {
        if (call.op !== "select") {
          writes.push(call)
          return Promise.resolve({ data: null, error: null })
        }
        return Promise.resolve({ data: rows()[0] ?? null, error: null })
      },
      then: (onFulfilled) => {
        if (call.op === "select") {
          return Promise.resolve({ data: rows(), error: null }).then(onFulfilled)
        }
        writes.push(call)
        return Promise.resolve({ data: null, error: null }).then(onFulfilled)
      },
    }

    return builder
  }

  return { from, writes }
}

type ServerClient = Awaited<ReturnType<typeof getSupabaseServerClient>>
type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

const USER = { id: "user-1" } as unknown as CurrentUser

const MODULES: Row[] = [
  { id: "booking", name: "Booking", is_available: true },
  { id: "invoicing", name: "Invoices & Receipts", is_available: true },
  { id: "delivery", name: "Delivery & Logistics", is_available: false },
]

const PLANS: Row[] = [
  {
    id: "free",
    name: "Libre",
    module_slots: 1,
    price_centavos: 0,
    sort_order: 0,
    is_active: true,
  },
  {
    id: "basic",
    name: "Basic",
    module_slots: 5,
    price_centavos: 29900,
    sort_order: 1,
    is_active: true,
  },
]

const TIERS: Row[] = [
  {
    id: "tier-booking-plus",
    module_id: "booking",
    name: "Plus",
    level: 2,
    price_centavos: 14900,
  },
  {
    id: "tier-booking-starter",
    module_id: "booking",
    name: "Starter",
    level: 1,
    price_centavos: 0,
  },
  {
    id: "tier-invoicing-starter",
    module_id: "invoicing",
    name: "Starter",
    level: 1,
    price_centavos: 0,
  },
]

function bookingOwned(tierId = "tier-booking-starter"): Row {
  return {
    id: "um-booking",
    user_id: "user-1",
    module_id: "booking",
    tier_id: tierId,
    status: "active",
  }
}

function mount(seed: Record<string, Row[]>) {
  const stub = createStub(seed)
  vi.mocked(getSupabaseServerClient).mockResolvedValue(
    stub as unknown as ServerClient
  )
  return stub
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentUser).mockResolvedValue(USER)
})

describe("activateModule", () => {
  it("refuses when nobody is signed in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const stub = mount({})

    const result = await activateModule("invoicing")

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/sign in/i)
    expect(stub.writes).toHaveLength(0)
  })

  it("refuses when Supabase is not configured", async () => {
    vi.mocked(getSupabaseServerClient).mockResolvedValue(null)

    const result = await activateModule("invoicing")

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/not connected|isn't connected/i)
  })

  it("blocks activation once the plan's module slots are full", async () => {
    const stub = mount({
      modules: MODULES,
      plans: PLANS,
      module_tiers: TIERS,
      subscriptions: [{ id: "sub-1", user_id: "user-1", plan_id: "free" }],
      user_modules: [bookingOwned()],
    })

    const result = await activateModule("invoicing")

    expect(result.ok).toBe(false)
    expect(result.message).toBe(
      "You're using all 1 module slot on Libre. Upgrade to Basic for 5."
    )
    expect(stub.writes).toHaveLength(0)
  })

  it("activates at the lowest tier when a slot is free", async () => {
    const stub = mount({
      modules: MODULES,
      plans: PLANS,
      module_tiers: TIERS,
      subscriptions: [{ id: "sub-1", user_id: "user-1", plan_id: "basic" }],
      user_modules: [bookingOwned()],
    })

    const result = await activateModule("booking")
    expect(result.message).toMatch(/already part of your raket/i)

    const added = await activateModule("invoicing")

    expect(added.ok).toBe(true)
    expect(added.message).toMatch(/Starter/)
    expect(stub.writes).toHaveLength(1)
    expect(stub.writes[0]).toMatchObject({
      table: "user_modules",
      op: "insert",
      payload: {
        user_id: "user-1",
        module_id: "invoicing",
        tier_id: "tier-invoicing-starter",
        status: "active",
      },
    })
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/marketplace")
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/dashboard")
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/raket")
  })

  it("will not activate a coming-soon module", async () => {
    const stub = mount({
      modules: MODULES,
      plans: PLANS,
      module_tiers: TIERS,
      subscriptions: [{ id: "sub-1", user_id: "user-1", plan_id: "basic" }],
      user_modules: [],
    })

    const result = await activateModule("delivery")

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/coming soon/i)
    expect(stub.writes).toHaveLength(0)
  })
})

describe("setModuleTier", () => {
  it("rejects a tier that belongs to another module", async () => {
    const stub = mount({
      module_tiers: TIERS,
      user_modules: [bookingOwned()],
    })

    const result = await setModuleTier("booking", "tier-invoicing-starter")

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/doesn't belong to this module/i)
    expect(stub.writes).toHaveLength(0)
  })

  it("rejects a tier the user does not own the module for", async () => {
    const stub = mount({ module_tiers: TIERS, user_modules: [] })

    const result = await setModuleTier("booking", "tier-booking-plus")

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/add this module/i)
    expect(stub.writes).toHaveLength(0)
  })

  it("moves the module up its own ladder", async () => {
    const stub = mount({
      module_tiers: TIERS,
      user_modules: [bookingOwned()],
    })

    const result = await setModuleTier("booking", "tier-booking-plus")

    expect(result.ok).toBe(true)
    expect(result.message).toMatch(/simulated upgrade/i)
    expect(stub.writes[0]).toMatchObject({
      table: "user_modules",
      op: "update",
      payload: { tier_id: "tier-booking-plus" },
      filters: { id: "um-booking", user_id: "user-1" },
    })
  })
})

describe("deactivateModule", () => {
  it("deletes only the caller's row", async () => {
    const stub = mount({
      modules: MODULES,
      user_modules: [bookingOwned()],
    })

    const result = await deactivateModule("booking")

    expect(result.ok).toBe(true)
    expect(stub.writes[0]).toMatchObject({
      table: "user_modules",
      op: "delete",
      filters: { user_id: "user-1", module_id: "booking" },
    })
  })

  it("refuses when nobody is signed in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const stub = mount({ modules: MODULES, user_modules: [bookingOwned()] })

    const result = await deactivateModule("booking")

    expect(result.ok).toBe(false)
    expect(stub.writes).toHaveLength(0)
  })
})

describe("changePlan", () => {
  it("switches plans and says the upgrade is simulated", async () => {
    const stub = mount({
      plans: PLANS,
      subscriptions: [{ id: "sub-1", user_id: "user-1", plan_id: "free" }],
      user_modules: [bookingOwned()],
    })

    const result = await changePlan("basic")

    expect(result.ok).toBe(true)
    expect(result.message).toMatch(/simulated/i)
    expect(result.message).toMatch(/nothing was charged/i)
    expect(stub.writes[0]).toMatchObject({
      table: "subscriptions",
      op: "update",
      payload: { plan_id: "basic" },
      filters: { id: "sub-1", user_id: "user-1" },
    })
  })

  it("blocks a downgrade that would not fit the active modules", async () => {
    const stub = mount({
      plans: PLANS,
      subscriptions: [{ id: "sub-1", user_id: "user-1", plan_id: "basic" }],
      user_modules: [
        bookingOwned(),
        { id: "um-2", user_id: "user-1", module_id: "invoicing", status: "active" },
        { id: "um-3", user_id: "user-1", module_id: "crm", status: "active" },
      ],
    })

    const result = await changePlan("free")

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/Remove 2 first/)
    expect(stub.writes).toHaveLength(0)
  })

  it("is a no-op when already on the plan", async () => {
    const stub = mount({
      plans: PLANS,
      subscriptions: [{ id: "sub-1", user_id: "user-1", plan_id: "basic" }],
      user_modules: [],
    })

    const result = await changePlan("basic")

    expect(result.ok).toBe(true)
    expect(result.message).toMatch(/already on Basic/i)
    expect(stub.writes).toHaveLength(0)
  })
})

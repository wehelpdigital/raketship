import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  addNode,
  connectNodes,
  deleteNode,
  disconnectNodes,
  ensureWorkspace,
  renameRaket,
  updateNodeData,
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

type Row = Record<string, unknown>

interface Recorded {
  table: string
  op: "select" | "insert" | "update" | "delete"
  payload?: Row
  filters: Array<[string, unknown]>
}

interface Chain {
  select: () => Chain
  insert: (payload: Row) => Chain
  update: (patch: Row) => Chain
  delete: () => Chain
  eq: (column: string, value: unknown) => Chain
  in: (column: string, value: unknown) => Chain
  order: () => Chain
  limit: () => Chain
  maybeSingle: () => Chain
  then: (
    resolve: (result: { data: unknown; error: null }) => unknown
  ) => Promise<unknown>
}

/**
 * Stand-in for the PostgREST builder: chainable, thenable, and it records what
 * each call filtered on so the tests can assert the user scoping.
 * `reads` is a queue of responses per table, drained in call order.
 */
function stubClient(reads: Record<string, unknown[]> = {}) {
  const recorded: Recorded[] = []
  const queues = new Map<string, unknown[]>(
    Object.entries(reads).map(([table, rows]) => [table, [...rows]])
  )
  const rpc = vi.fn().mockResolvedValue({ error: null })

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
      in: (column, value) => {
        entry.filters.push([column, value])
        return chain
      },
      order: () => chain,
      limit: () => chain,
      maybeSingle: () => chain,
      then: (resolve) => {
        const queue = queues.get(table)
        const data = queue && queue.length > 0 ? queue.shift() : null
        return Promise.resolve({ data: data ?? null, error: null }).then(resolve)
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
  }
}

function filterValue(entry: Recorded | undefined, column: string) {
  return entry?.filters.find(([name]) => name === column)?.[1]
}

const MODULE_FLOW = {
  id: "flow-1",
  raket_id: "raket-1",
  user_id: "user-1",
  kind: "module",
  module_id: "booking",
  parent_node_id: "node-1",
  name: "Booking flow",
}

const RAKET_FLOW = {
  ...MODULE_FLOW,
  kind: "raket",
  module_id: null,
  parent_node_id: null,
}

const STARTER = { tier: { node_types: ["booking", "timer", "email"] } }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getCurrentUser.mockResolvedValue({ id: "user-1" })
})

describe("addNode", () => {
  it("writes nothing when nobody is signed in", async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    const db = stubClient()

    const result = await addNode({ flowId: "flow-1", type: "timer", x: 0, y: 0 })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/sign in/i)
    expect(db.writes()).toHaveLength(0)
  })

  it("says so calmly when Supabase is not configured", async () => {
    mocks.getSupabaseServerClient.mockResolvedValue(null)

    const result = await addNode({ flowId: "flow-1", type: "timer", x: 0, y: 0 })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/not connected/i)
  })

  it("refuses an element the registry has never heard of", async () => {
    const db = stubClient()

    const result = await addNode({
      flowId: "flow-1",
      type: "teleporter",
      x: 0,
      y: 0,
    })

    expect(result.ok).toBe(false)
    expect(db.writes()).toHaveLength(0)
  })

  it("refuses a bare module node, which would have no inner canvas", async () => {
    const db = stubClient({ flows: [RAKET_FLOW] })

    const result = await addNode({
      flowId: "flow-1",
      type: "module",
      x: 0,
      y: 0,
    })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/marketplace/i)
    expect(db.writes()).toHaveLength(0)
  })

  it("refuses an element from the other canvas", async () => {
    const db = stubClient({ flows: [MODULE_FLOW] })

    const result = await addNode({ flowId: "flow-1", type: "start", x: 0, y: 0 })

    expect(result.ok).toBe(false)
    expect(db.writes()).toHaveLength(0)
  })

  it("re-enforces tier gating server-side", async () => {
    const db = stubClient({ flows: [MODULE_FLOW], user_modules: [STARTER] })

    const result = await addNode({ flowId: "flow-1", type: "sms", x: 0, y: 0 })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/higher tier/i)
    expect(db.writes()).toHaveLength(0)
  })

  it("degrades closed when the module was never activated", async () => {
    const db = stubClient({ flows: [MODULE_FLOW] })

    const result = await addNode({ flowId: "flow-1", type: "timer", x: 0, y: 0 })

    expect(result.ok).toBe(false)
    expect(db.writes()).toHaveLength(0)
  })

  it("honours maxPerFlow so a flow keeps one trigger", async () => {
    const db = stubClient({
      flows: [MODULE_FLOW],
      user_modules: [STARTER],
      flow_nodes: [[{ node_key: "booking-1", type: "booking" }]],
    })

    const result = await addNode({
      flowId: "flow-1",
      type: "booking",
      x: 0,
      y: 0,
    })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/only have one/i)
    expect(db.writes()).toHaveLength(0)
  })

  it("stamps the session's user id and a free node key on the insert", async () => {
    const db = stubClient({
      flows: [MODULE_FLOW],
      user_modules: [STARTER],
      flow_nodes: [[{ node_key: "timer-1", type: "timer" }]],
    })

    const result = await addNode({
      flowId: "flow-1",
      type: "timer",
      x: 41.6,
      y: 183.2,
    })

    expect(result).toEqual({ ok: true, nodeKey: "timer-2" })

    const insert = db.firstWrite()
    expect(insert?.table).toBe("flow_nodes")
    expect(insert?.payload).toMatchObject({
      flow_id: "flow-1",
      user_id: "user-1",
      node_key: "timer-2",
      type: "timer",
      module_id: "booking",
      position_x: 42,
      position_y: 183,
    })
    expect(insert?.payload?.data).toMatchObject({
      label: "Wait",
      delayValue: 1,
      delayUnit: "hours",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/raket/node-1")
  })
})

describe("updateNodeData", () => {
  it("re-derives values from the registry instead of trusting the client", async () => {
    const db = stubClient({
      flows: [MODULE_FLOW],
      flow_nodes: [
        { id: "n1", node_key: "timer-1", type: "timer", data: { label: "Wait" } },
      ],
    })

    const result = await updateNodeData({
      flowId: "flow-1",
      nodeKey: "timer-1",
      values: {
        label: "Hintay muna",
        delayValue: 9999,
        delayUnit: "fortnights",
        is_admin: true,
      },
    })

    expect(result.ok).toBe(true)

    const update = db.firstWrite()
    expect(update?.op).toBe("update")
    expect(update?.payload?.data).toEqual({
      label: "Hintay muna",
      delayValue: 999,
    })
    expect(filterValue(update, "user_id")).toBe("user-1")
    expect(filterValue(update, "id")).toBe("n1")
  })

  it("leaves the canvas alone when the step has gone", async () => {
    const db = stubClient({ flows: [MODULE_FLOW] })

    const result = await updateNodeData({
      flowId: "flow-1",
      nodeKey: "timer-9",
      values: { label: "x" },
    })

    expect(result.ok).toBe(false)
    expect(db.writes()).toHaveLength(0)
  })
})

describe("deleteNode", () => {
  it("keeps the root of the raket", async () => {
    const db = stubClient({
      flows: [RAKET_FLOW],
      flow_nodes: [{ id: "n0", node_key: "start", type: "start" }],
    })

    const result = await deleteNode({ flowId: "flow-1", nodeKey: "start" })

    expect(result.ok).toBe(false)
    expect(db.writes()).toHaveLength(0)
  })

  it("keeps the only trigger a flow has", async () => {
    const db = stubClient({
      flows: [MODULE_FLOW],
      flow_nodes: [{ id: "n1", node_key: "booking-1", type: "booking" }],
    })

    const result = await deleteNode({ flowId: "flow-1", nodeKey: "booking-1" })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/trigger/i)
    expect(db.writes()).toHaveLength(0)
  })

  it("clears both ends of the step's lines with filtered deletes", async () => {
    const db = stubClient({
      flows: [MODULE_FLOW],
      flow_nodes: [{ id: "n2", node_key: "timer-1", type: "timer" }],
    })

    const result = await deleteNode({ flowId: "flow-1", nodeKey: "timer-1" })

    expect(result.ok).toBe(true)

    const deletes = db.writes()
    expect(deletes.map((entry) => entry.table)).toEqual([
      "flow_edges",
      "flow_edges",
      "flow_nodes",
    ])
    expect(filterValue(deletes[0], "source_key")).toBe("timer-1")
    expect(filterValue(deletes[1], "target_key")).toBe("timer-1")
    for (const entry of deletes) {
      expect(filterValue(entry, "user_id")).toBe("user-1")
    }
  })
})

describe("connectNodes", () => {
  it("refuses a step that points at itself before touching the database", async () => {
    const db = stubClient()

    const result = await connectNodes({
      flowId: "flow-1",
      source: "timer-1",
      target: "timer-1",
    })

    expect(result.ok).toBe(false)
    expect(db.recorded).toHaveLength(0)
  })

  it("refuses a line to a step that is not on the canvas", async () => {
    const db = stubClient({
      flows: [MODULE_FLOW],
      flow_nodes: [[{ node_key: "timer-1" }]],
    })

    const result = await connectNodes({
      flowId: "flow-1",
      source: "timer-1",
      target: "ghost-1",
    })

    expect(result.ok).toBe(false)
    expect(db.writes()).toHaveLength(0)
  })

  it("stores a readable edge key scoped to the owner", async () => {
    const db = stubClient({
      flows: [MODULE_FLOW],
      flow_nodes: [[{ node_key: "timer-1" }, { node_key: "email-1" }]],
    })

    const result = await connectNodes({
      flowId: "flow-1",
      source: "timer-1",
      target: "email-1",
    })

    expect(result.ok).toBe(true)
    expect(db.firstWrite()?.payload).toMatchObject({
      flow_id: "flow-1",
      user_id: "user-1",
      edge_key: "timer-1->email-1",
      source_key: "timer-1",
      target_key: "email-1",
    })
  })
})

describe("disconnectNodes", () => {
  it("deletes only the owner's edge on the named flow", async () => {
    const db = stubClient({ flows: [MODULE_FLOW] })

    const result = await disconnectNodes({
      flowId: "flow-1",
      edgeKey: "timer-1->email-1",
    })

    expect(result.ok).toBe(true)

    const remove = db.firstWrite()
    expect(remove?.op).toBe("delete")
    expect(filterValue(remove, "user_id")).toBe("user-1")
    expect(filterValue(remove, "edge_key")).toBe("timer-1->email-1")
  })
})

describe("renameRaket", () => {
  it("rejects an empty name", async () => {
    const db = stubClient()

    const result = await renameRaket({ raketId: "raket-1", name: "   " })

    expect(result.ok).toBe(false)
    expect(db.writes()).toHaveLength(0)
  })

  it("rejects a name over 60 characters", async () => {
    const db = stubClient()

    const result = await renameRaket({
      raketId: "raket-1",
      name: "x".repeat(61),
    })

    expect(result.ok).toBe(false)
    expect(db.writes()).toHaveLength(0)
  })

  it("collapses whitespace and scopes the update to the owner", async () => {
    const db = stubClient({ rakets: [{ id: "raket-1" }] })

    const result = await renameRaket({
      raketId: "raket-1",
      name: "  Nena's   Bakeshop  ",
    })

    expect(result.ok).toBe(true)

    const update = db.firstWrite()
    expect(update?.payload).toEqual({ name: "Nena's Bakeshop" })
    expect(filterValue(update, "user_id")).toBe("user-1")
    expect(filterValue(update, "id")).toBe("raket-1")
  })

  it("reports failure when no row belonged to this user", async () => {
    stubClient()

    const result = await renameRaket({ raketId: "someone-else", name: "Mine" })

    expect(result.ok).toBe(false)
  })
})

describe("ensureWorkspace", () => {
  it("asks Postgres to repair the workspace for the caller only", async () => {
    const db = stubClient()

    const result = await ensureWorkspace()

    expect(result.ok).toBe(true)
    expect(db.rpc).toHaveBeenCalledWith("ensure_my_workspace")
  })

  it("refuses without a session", async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    const db = stubClient()

    const result = await ensureWorkspace()

    expect(result.ok).toBe(false)
    expect(db.rpc).not.toHaveBeenCalled()
  })
})

import { describe, expect, it } from "vitest"

import {
  CANVAS_NODE_COMPONENT,
  canAddNode,
  countOfType,
  edgeKey,
  linearise,
  moduleNodeHref,
  nextNodeKey,
  nextNodePosition,
  rowToCanvasEdge,
  rowToCanvasNode,
  unlockedNodeTypes,
  type CanvasEdge,
  type CanvasNode,
} from "@/lib/flow/mappers"
import type { FlowEdgeRow, FlowNodeRow } from "@/lib/supabase/types"

function nodeRow(overrides: Partial<FlowNodeRow> = {}): FlowNodeRow {
  return {
    id: "node-id",
    flow_id: "flow-1",
    user_id: "user-1",
    node_key: "timer-1",
    type: "timer",
    module_id: "booking",
    position_x: 40,
    position_y: 184,
    data: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function edgeRow(overrides: Partial<FlowEdgeRow> = {}): FlowEdgeRow {
  return {
    id: "edge-id",
    flow_id: "flow-1",
    user_id: "user-1",
    edge_key: "booking-1->timer-1",
    source_key: "booking-1",
    target_key: "timer-1",
    label: null,
    animated: true,
    data: {},
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function canvasNode(id: string, nodeType: string): CanvasNode {
  return {
    id,
    type: CANVAS_NODE_COMPONENT,
    position: { x: 0, y: 0 },
    data: { nodeType, moduleId: null, locked: false, values: {} },
  }
}

function canvasEdge(source: string, target: string): CanvasEdge {
  return {
    id: edgeKey(source, target),
    source,
    target,
    animated: true,
  }
}

describe("rowToCanvasNode", () => {
  it("layers stored values over the registry defaults", () => {
    const node = rowToCanvasNode(nodeRow({ data: { delayValue: 3 } }))

    expect(node.id).toBe("timer-1")
    expect(node.type).toBe(CANVAS_NODE_COMPONENT)
    expect(node.position).toEqual({ x: 40, y: 184 })
    expect(node.data.values.delayValue).toBe(3)
    expect(node.data.values.delayUnit).toBe("hours")
  })

  it("leaves nodes unlocked when no tier is supplied", () => {
    expect(rowToCanvasNode(nodeRow({ type: "sms" })).data.locked).toBe(false)
  })

  it("locks an element the tier does not include", () => {
    const locked = rowToCanvasNode(nodeRow({ type: "sms", node_key: "sms-1" }), {
      unlockedTypes: ["booking", "timer", "email"],
    })
    expect(locked.data.locked).toBe(true)
  })

  it("never locks the structural elements", () => {
    const start = rowToCanvasNode(
      nodeRow({ type: "start", node_key: "start", module_id: null }),
      { unlockedTypes: [] }
    )
    const moduleNode = rowToCanvasNode(
      nodeRow({ type: "module", node_key: "module-booking" }),
      { unlockedTypes: [] }
    )

    expect(start.data.locked).toBe(false)
    expect(moduleNode.data.locked).toBe(false)
  })
})

describe("rowToCanvasEdge", () => {
  it("maps keys across and drops a null label", () => {
    expect(rowToCanvasEdge(edgeRow())).toEqual({
      id: "booking-1->timer-1",
      source: "booking-1",
      target: "timer-1",
      label: undefined,
      animated: true,
    })
  })
})

describe("nextNodeKey", () => {
  it("starts at one and skips keys already taken", () => {
    expect(nextNodeKey([], "timer")).toBe("timer-1")
    expect(nextNodeKey(["timer-1", "timer-2"], "timer")).toBe("timer-3")
    expect(nextNodeKey(["timer-2"], "timer")).toBe("timer-1")
  })

  it("keeps keys unique across repeated calls", () => {
    const keys: string[] = []
    for (let i = 0; i < 25; i++) keys.push(nextNodeKey(keys, "email"))
    expect(new Set(keys).size).toBe(25)
  })

  it("does not collide with another element's numbering", () => {
    expect(nextNodeKey(["timer-1"], "email")).toBe("email-1")
  })
})

describe("countOfType / canAddNode", () => {
  it("counts by element type, not by key", () => {
    const nodes = [canvasNode("timer-1", "timer"), canvasNode("timer-2", "timer")]
    expect(countOfType(nodes, "timer")).toBe(2)
    expect(countOfType(nodes, "email")).toBe(0)
  })

  it("refuses a second trigger because maxPerFlow is 1", () => {
    const result = canAddNode([canvasNode("booking-1", "booking")], "booking")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain("only have one")
  })

  it("allows uncapped elements", () => {
    expect(canAddNode([canvasNode("timer-1", "timer")], "timer").ok).toBe(true)
  })

  it("allows the first trigger on an empty canvas", () => {
    expect(canAddNode([], "booking").ok).toBe(true)
  })
})

describe("nextNodePosition", () => {
  it("seeds the first element near the top-left", () => {
    expect(nextNodePosition([])).toEqual({ x: 40, y: 24 })
  })

  it("stacks below the lowest element, keeping its column", () => {
    expect(
      nextNodePosition([
        { position: { x: 40, y: 24 } },
        { position: { x: 120, y: 184 } },
      ])
    ).toEqual({ x: 120, y: 344 })
  })
})

describe("linearise", () => {
  it("returns nothing for an empty canvas", () => {
    expect(linearise([], [])).toEqual([])
  })

  it("follows the edges from the trigger", () => {
    const nodes = [
      canvasNode("email-1", "email"),
      canvasNode("booking-1", "booking"),
      canvasNode("timer-1", "timer"),
    ]
    const edges = [
      canvasEdge("booking-1", "timer-1"),
      canvasEdge("timer-1", "email-1"),
    ]

    expect(linearise(nodes, edges).map((node) => node.id)).toEqual([
      "booking-1",
      "timer-1",
      "email-1",
    ])
  })

  it("lists a disconnected element after the connected run", () => {
    const nodes = [
      canvasNode("booking-1", "booking"),
      canvasNode("timer-1", "timer"),
      canvasNode("sms-1", "sms"),
    ]
    const edges = [canvasEdge("booking-1", "timer-1")]

    expect(linearise(nodes, edges).map((node) => node.id)).toEqual([
      "booking-1",
      "timer-1",
      "sms-1",
    ])
  })

  it("breaks a cycle instead of looping forever", () => {
    const nodes = [
      canvasNode("a", "timer"),
      canvasNode("b", "timer"),
      canvasNode("c", "timer"),
    ]
    const edges = [canvasEdge("a", "b"), canvasEdge("b", "c"), canvasEdge("c", "a")]

    const ordered = linearise(nodes, edges)
    expect(ordered).toHaveLength(3)
    expect(ordered.map((node) => node.id)).toEqual(["a", "b", "c"])
  })

  it("visits every element exactly once when the graph branches", () => {
    const nodes = [
      canvasNode("booking-1", "booking"),
      canvasNode("timer-1", "timer"),
      canvasNode("email-1", "email"),
    ]
    const edges = [
      canvasEdge("booking-1", "timer-1"),
      canvasEdge("booking-1", "email-1"),
      canvasEdge("timer-1", "email-1"),
    ]

    const ids = linearise(nodes, edges).map((node) => node.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids[0]).toBe("booking-1")
  })
})

describe("unlockedNodeTypes", () => {
  it("degrades closed when there is no tier", () => {
    expect(unlockedNodeTypes(null)).toEqual([])
    expect(unlockedNodeTypes(undefined)).toEqual([])
  })

  it("returns the tier's element list", () => {
    expect(unlockedNodeTypes({ node_types: ["booking", "timer"] })).toEqual([
      "booking",
      "timer",
    ])
  })

  it("ignores anything that is not a string", () => {
    expect(
      unlockedNodeTypes({
        node_types: ["booking", 7, null] as unknown as string[],
      })
    ).toEqual(["booking"])
  })

  it("degrades closed when node_types is not an array", () => {
    expect(
      unlockedNodeTypes({ node_types: "booking" as unknown as string[] })
    ).toEqual([])
  })
})

describe("edgeKey", () => {
  it("is stable and readable", () => {
    expect(edgeKey("booking-1", "timer-1")).toBe("booking-1->timer-1")
  })
})

describe("moduleNodeHref", () => {
  it("sends Booking straight to what an owner actually checks", () => {
    expect(moduleNodeHref("booking", "abc-123")).toBe("/modules/booking/booked")
  })

  it("opens every other module's inner canvas", () => {
    expect(moduleNodeHref("product-catalog", "abc-123")).toBe("/raket/abc-123")
    expect(moduleNodeHref(null, "abc-123")).toBe("/raket/abc-123")
  })
})

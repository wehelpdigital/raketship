/**
 * Translation layer between database rows and the shapes React Flow wants.
 *
 * Kept free of any @xyflow/react import so it stays cheap to unit test.
 */

import type { FlowEdgeRow, FlowNodeRow, ModuleTierRow } from "@/lib/supabase/types"
import type { ModuleGlance } from "@/lib/flow/glance"
import { resolveNodeType, withDefaults } from "@/lib/flow/registry"

export interface CanvasNodeData extends Record<string, unknown> {
  nodeType: string
  moduleId: string | null
  locked: boolean
  values: Record<string, unknown>
  /** Live facts for a module card, assembled server-side. See glance.ts. */
  glance?: ModuleGlance
  /** Position in the entrance stagger; absent means arrive without ceremony. */
  enterIndex?: number
  /** The module's own accent, icon and tagline, off its catalog row. */
  accent?: string
  icon?: string
  tagline?: string
  /** Which side a Clients wire enters this card, if one does. */
  sideTarget?: "left" | "right"
}

export interface CanvasNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: CanvasNodeData
  /** Presentational nodes refuse every interaction React Flow offers. */
  draggable?: boolean
  selectable?: boolean
  connectable?: boolean
}

export interface CanvasEdge {
  id: string
  source: string
  target: string
  label?: string
  animated: boolean
  /** A named handle on the target — the presentation wires enter door SIDES. */
  targetHandle?: string
}

/**
 * React Flow renders one component per `type`. We register a single "element"
 * renderer and pass the real node type through `data`, so adding an element to
 * the registry needs no React Flow wiring.
 */
export const CANVAS_NODE_COMPONENT = "element"

export function rowToCanvasNode(
  row: FlowNodeRow,
  opts: { unlockedTypes?: readonly string[] } = {}
): CanvasNode {
  const locked =
    opts.unlockedTypes !== undefined &&
    !isAlwaysAvailable(row.type) &&
    !opts.unlockedTypes.includes(row.type)

  return {
    id: row.node_key,
    type: CANVAS_NODE_COMPONENT,
    position: { x: row.position_x, y: row.position_y },
    data: {
      nodeType: row.type,
      moduleId: row.module_id,
      locked,
      values: withDefaults(row.type, (row.data ?? {}) as Record<string, unknown>),
    },
  }
}

export function rowToCanvasEdge(row: FlowEdgeRow): CanvasEdge {
  return {
    id: row.edge_key,
    source: row.source_key,
    target: row.target_key,
    label: row.label ?? undefined,
    animated: row.animated,
  }
}

/** Structural elements are never tier-gated. */
function isAlwaysAvailable(type: string): boolean {
  return type === "start" || type === "module"
}

/**
 * Which element types this user may place, given the tier they own for a
 * module. A missing tier means "starter only" rather than "everything", so an
 * unprovisioned account degrades closed instead of open.
 */
export function unlockedNodeTypes(
  tier: Pick<ModuleTierRow, "node_types"> | null | undefined
): string[] {
  if (!tier || !Array.isArray(tier.node_types)) return []
  return tier.node_types.filter((t): t is string => typeof t === "string")
}

/**
 * Generate a node key that is unique within a canvas: `timer-1`, `timer-2`, …
 * Keys are stable and human-readable, which makes edge rows readable too.
 */
export function nextNodeKey(
  existingKeys: readonly string[],
  type: string
): string {
  const taken = new Set(existingKeys)
  for (let i = 1; i < 10_000; i++) {
    const candidate = `${type}-${i}`
    if (!taken.has(candidate)) return candidate
  }
  // Practically unreachable; keeps the signature total.
  return `${type}-${existingKeys.length + 1}`
}

/**
 * Where tapping a module node on the outer board leads.
 *
 * Booking's builder ships pre-wired, so its node opens what an owner actually
 * checks — the Booked list. Every other module opens its inner canvas.
 */
export function moduleNodeHref(
  moduleId: string | null,
  nodeDbId: string
): string {
  if (moduleId === "booking") return "/modules/booking/booked"
  // The Client Manager IS its page — it has no inner canvas to open.
  if (moduleId === "client-manager") return "/modules/client-manager"
  if (moduleId === "website") return "/modules/website"
  if (moduleId === "product-catalog") return "/modules/product-catalog"
  return `/raket/${nodeDbId}`
}

export function edgeKey(source: string, target: string): string {
  return `${source}->${target}`
}

/**
 * How many of this type already sit on the canvas — used to enforce
 * `maxPerFlow` before we let the palette add another.
 */
export function countOfType(
  nodes: readonly { data: { nodeType: string } }[],
  type: string
): number {
  return nodes.filter((n) => n.data.nodeType === type).length
}

export function canAddNode(
  nodes: readonly { data: { nodeType: string } }[],
  type: string
): { ok: true } | { ok: false; reason: string } {
  const def = resolveNodeType(type)
  if (def.maxPerFlow !== undefined && countOfType(nodes, type) >= def.maxPerFlow) {
    return {
      ok: false,
      reason:
        def.maxPerFlow === 1
          ? `A flow can only have one "${def.label}" step.`
          : `You can only add ${def.maxPerFlow} "${def.label}" steps.`,
    }
  }
  return { ok: true }
}

/**
 * Where to drop a newly added element so it lands below the current stack
 * rather than on top of an existing card. Vertical layout reads better on a
 * phone than React Flow's usual left-to-right arrangement.
 */
export function nextNodePosition(
  nodes: readonly { position: { x: number; y: number } }[]
): { x: number; y: number } {
  if (nodes.length === 0) return { x: 40, y: 24 }
  const lowest = nodes.reduce((acc, n) =>
    n.position.y > acc.position.y ? n : acc
  )
  return { x: lowest.position.x, y: lowest.position.y + 160 }
}

/**
 * Follows the edges from the trigger to produce the running order shown in the
 * "Preview run" sheet. Cycles are broken by tracking visited keys.
 */
export function linearise(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[]
): CanvasNode[] {
  if (nodes.length === 0) return []

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const targets = new Set(edges.map((e) => e.target))
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    const list = outgoing.get(edge.source) ?? []
    list.push(edge.target)
    outgoing.set(edge.source, list)
  }

  const roots = nodes.filter((n) => !targets.has(n.id))
  const start = roots[0] ?? nodes[0]

  const ordered: CanvasNode[] = []
  const seen = new Set<string>()
  const queue = [start.id]

  while (queue.length > 0) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    const node = byId.get(id)
    if (node) ordered.push(node)
    for (const next of outgoing.get(id) ?? []) {
      if (!seen.has(next)) queue.push(next)
    }
  }

  // Anything unreachable still deserves to be listed, after the connected run.
  for (const node of nodes) {
    if (!seen.has(node.id)) ordered.push(node)
  }

  return ordered
}

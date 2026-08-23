"use server"

import { revalidatePath } from "next/cache"

import { canAddNode, edgeKey, nextNodeKey, unlockedNodeTypes } from "@/lib/flow/mappers"
import { getNodeType, resolveNodeType, withDefaults } from "@/lib/flow/registry"
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server"
import type {
  Database,
  FlowNodeRow,
  FlowRow,
  Json,
  ModuleTierRow,
} from "@/lib/supabase/types"

type Db = NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>

type Tables = Database["public"]["Tables"]
type Insert<T extends keyof Tables> = Tables[T]["Insert"]
type Patch<T extends keyof Tables> = Tables[T]["Update"]

type Result = { ok: boolean; message?: string; nodeKey?: string }

const NO_DATABASE = "RaketShip is not connected to Supabase yet."
const SIGN_IN_AGAIN = "Please sign in again to save your changes."
const NOT_FOUND = "We could not find that canvas."

function fail(message: string): Result {
  return { ok: false, message }
}

async function requireSession(): Promise<
  { db: Db; userId: string } | { error: Result }
> {
  const db = await getSupabaseServerClient()
  if (!db) return { error: fail(NO_DATABASE) }
  const user = await getCurrentUser()
  if (!user) return { error: fail(SIGN_IN_AGAIN) }
  return { db, userId: user.id }
}

/** Always scoped by user_id — an id from the client is never trusted on its own. */
async function loadFlow(
  db: Db,
  userId: string,
  flowId: string
): Promise<FlowRow | null> {
  const { data } = await db
    .from("flows")
    .select("*")
    .eq("id", flowId)
    .eq("user_id", userId)
    .maybeSingle()
  return (data as FlowRow | null) ?? null
}

async function loadNode(
  db: Db,
  userId: string,
  flowId: string,
  nodeKey: string
): Promise<FlowNodeRow | null> {
  const { data } = await db
    .from("flow_nodes")
    .select("*")
    .eq("flow_id", flowId)
    .eq("node_key", nodeKey)
    .eq("user_id", userId)
    .maybeSingle()
  return (data as FlowNodeRow | null) ?? null
}

/** The route whose cache a write on this flow invalidates. */
function pathForFlow(flow: FlowRow): string {
  return flow.kind === "module" && flow.parent_node_id
    ? `/raket/${flow.parent_node_id}`
    : "/raket"
}

function isStructural(type: string): boolean {
  return type === "start" || type === "module"
}

/**
 * Tier gating is enforced here as well as in the palette: a server action is a
 * reachable POST endpoint, so a locked element has to be refused server-side.
 */
async function elementIsUnlocked(
  db: Db,
  userId: string,
  flow: FlowRow,
  type: string
): Promise<boolean> {
  if (isStructural(type)) return true
  if (flow.kind !== "module" || !flow.module_id) return true

  const { data } = await db
    .from("user_modules")
    .select("tier:module_tiers(*)")
    .eq("user_id", userId)
    .eq("module_id", flow.module_id)
    .maybeSingle()

  const tier = (data as { tier: ModuleTierRow | null } | null)?.tier ?? null
  return unlockedNodeTypes(tier).includes(type)
}

function coordinate(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : 0
}

/**
 * Values arriving from the inspector are re-derived from the registry rather
 * than trusted: unknown keys are dropped, selects must match an option, and
 * numbers are clamped to the field's range.
 */
function sanitiseValues(
  type: string,
  values: Record<string, unknown>
): Record<string, Json> {
  const def = resolveNodeType(type)
  const clean: Record<string, Json> = {}

  for (const field of def.fields) {
    const raw = values[field.key]
    if (raw === undefined || raw === null) continue

    if (field.type === "number") {
      const parsed = typeof raw === "number" ? raw : Number(String(raw).trim())
      if (!Number.isFinite(parsed)) continue
      let next = parsed
      if (field.min !== undefined) next = Math.max(field.min, next)
      if (field.max !== undefined) next = Math.min(field.max, next)
      clean[field.key] = next
      continue
    }

    if (field.type === "select") {
      const candidate = String(raw)
      if (field.options.some((option) => option.value === candidate)) {
        clean[field.key] = candidate
      }
      continue
    }

    const limit = field.type === "textarea" ? 2000 : 200
    clean[field.key] = String(raw).slice(0, limit)
  }

  return clean
}

export async function addNode(input: {
  flowId: string
  type: string
  x: number
  y: number
}): Promise<Result> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const def = getNodeType(input.type)
  if (!def) return fail("That element is not part of the toolkit.")
  // A module node is only meaningful alongside the inner flow that provisioning
  // creates for it, so it never arrives through the palette.
  if (input.type === "module") {
    return fail("Modules join your raket from the marketplace.")
  }

  const flow = await loadFlow(db, userId, input.flowId)
  if (!flow) return fail(NOT_FOUND)
  if (def.scope !== flow.kind) {
    return fail(`"${def.label}" does not belong on this canvas.`)
  }
  if (!(await elementIsUnlocked(db, userId, flow, input.type))) {
    return fail(`"${def.label}" is part of a higher tier. Upgrade to use it.`)
  }

  const { data: existingRows } = await db
    .from("flow_nodes")
    .select("node_key, type")
    .eq("flow_id", flow.id)

  const existing =
    (existingRows as Pick<FlowNodeRow, "node_key" | "type">[] | null) ?? []

  const guard = canAddNode(
    existing.map((row) => ({ data: { nodeType: row.type } })),
    input.type
  )
  if (!guard.ok) return fail(guard.reason)

  const nodeKey = nextNodeKey(
    existing.map((row) => row.node_key),
    input.type
  )

  const payload: Insert<"flow_nodes"> = {
    flow_id: flow.id,
    user_id: userId,
    node_key: nodeKey,
    type: input.type,
    module_id: def.moduleId ?? null,
    position_x: coordinate(input.x),
    position_y: coordinate(input.y),
    data: sanitiseValues(input.type, withDefaults(input.type)),
  }

  const { error } = await db.from("flow_nodes").insert(payload)
  if (error) return fail("We could not add that step. Please try again.")

  revalidatePath(pathForFlow(flow))
  return { ok: true, nodeKey }
}

/**
 * Runs on every drag release, so it stays deliberately thin: no flow lookup and
 * no revalidation — a position never changes what the server renders.
 */
export async function updateNodePosition(input: {
  flowId: string
  nodeKey: string
  x: number
  y: number
}): Promise<Result> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const patch: Patch<"flow_nodes"> = {
    position_x: coordinate(input.x),
    position_y: coordinate(input.y),
  }

  const { error } = await db
    .from("flow_nodes")
    .update(patch)
    .eq("user_id", userId)
    .eq("flow_id", input.flowId)
    .eq("node_key", input.nodeKey)

  if (error) return fail("We could not save that position.")
  return { ok: true }
}

export async function updateNodeData(input: {
  flowId: string
  nodeKey: string
  values: Record<string, unknown>
}): Promise<Result> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const flow = await loadFlow(db, userId, input.flowId)
  if (!flow) return fail(NOT_FOUND)

  const node = await loadNode(db, userId, flow.id, input.nodeKey)
  if (!node) return fail("That step is no longer on the canvas.")

  const merged: Record<string, Json> = {
    ...(node.data ?? {}),
    ...sanitiseValues(node.type, input.values),
  }

  const patch: Patch<"flow_nodes"> = { data: merged }
  const { error } = await db
    .from("flow_nodes")
    .update(patch)
    .eq("id", node.id)
    .eq("user_id", userId)
  if (error) return fail("We could not save those details.")

  revalidatePath(pathForFlow(flow))
  return { ok: true }
}

export async function deleteNode(input: {
  flowId: string
  nodeKey: string
}): Promise<Result> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const flow = await loadFlow(db, userId, input.flowId)
  if (!flow) return fail(NOT_FOUND)

  const node = await loadNode(db, userId, flow.id, input.nodeKey)
  if (!node) return { ok: true }

  if (node.type === "start") {
    return fail("The start of your raket stays put.")
  }
  if (node.type === "module") {
    return fail("Pause a module from the marketplace to take it off the canvas.")
  }

  const def = resolveNodeType(node.type)
  if (def.category === "trigger" && def.maxPerFlow === 1) {
    return fail("Every flow needs its trigger. Edit it instead of deleting it.")
  }

  // Two filtered deletes rather than one `.or()` expression: the key comes from
  // the client and must never be spliced into a PostgREST filter string.
  await db
    .from("flow_edges")
    .delete()
    .eq("flow_id", flow.id)
    .eq("user_id", userId)
    .eq("source_key", node.node_key)
  await db
    .from("flow_edges")
    .delete()
    .eq("flow_id", flow.id)
    .eq("user_id", userId)
    .eq("target_key", node.node_key)

  const { error } = await db
    .from("flow_nodes")
    .delete()
    .eq("id", node.id)
    .eq("user_id", userId)
  if (error) return fail("We could not remove that step.")

  revalidatePath(pathForFlow(flow))
  return { ok: true }
}

export async function connectNodes(input: {
  flowId: string
  source: string
  target: string
}): Promise<Result> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  if (input.source === input.target) {
    return fail("A step cannot connect to itself.")
  }

  const flow = await loadFlow(db, userId, input.flowId)
  if (!flow) return fail(NOT_FOUND)

  const { data: endpointRows } = await db
    .from("flow_nodes")
    .select("node_key")
    .eq("flow_id", flow.id)
    .eq("user_id", userId)
    .in("node_key", [input.source, input.target])

  const endpoints =
    (endpointRows as Pick<FlowNodeRow, "node_key">[] | null) ?? []
  if (endpoints.length < 2) {
    return fail("Both steps need to be on the canvas first.")
  }

  const key = edgeKey(input.source, input.target)
  const { data: duplicate } = await db
    .from("flow_edges")
    .select("id")
    .eq("flow_id", flow.id)
    .eq("user_id", userId)
    .eq("edge_key", key)
    .maybeSingle()
  if (duplicate) return fail("Those steps are already connected.")

  const payload: Insert<"flow_edges"> = {
    flow_id: flow.id,
    user_id: userId,
    edge_key: key,
    source_key: input.source,
    target_key: input.target,
    animated: true,
  }

  const { error } = await db.from("flow_edges").insert(payload)
  if (error) return fail("We could not connect those steps.")

  revalidatePath(pathForFlow(flow))
  return { ok: true }
}

export async function disconnectNodes(input: {
  flowId: string
  edgeKey: string
}): Promise<Result> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const flow = await loadFlow(db, userId, input.flowId)
  if (!flow) return fail(NOT_FOUND)

  const { error } = await db
    .from("flow_edges")
    .delete()
    .eq("flow_id", flow.id)
    .eq("user_id", userId)
    .eq("edge_key", input.edgeKey)
  if (error) return fail("We could not remove that connection.")

  revalidatePath(pathForFlow(flow))
  return { ok: true }
}

export async function renameRaket(input: {
  raketId: string
  name: string
}): Promise<Result> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const name = input.name.trim().replace(/\s+/g, " ")
  if (name.length < 1 || name.length > 60) {
    return fail("Give your raket a name between 1 and 60 characters.")
  }

  const patch: Patch<"rakets"> = { name }
  const { data, error } = await db
    .from("rakets")
    .update(patch)
    .eq("id", input.raketId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle()

  if (error || !data) return fail("We could not rename that raket.")

  revalidatePath("/raket")
  revalidatePath("/dashboard")
  return { ok: true }
}

/**
 * Repairs an account that was created while the provisioning trigger was
 * missing, by asking Postgres to build the workspace it should already have.
 */
export async function ensureWorkspace(): Promise<Result> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db } = session

  const { error } = await db.rpc("ensure_my_workspace")
  if (error) {
    return fail(
      "We could not set up your raket. Check that the database migrations have been applied."
    )
  }

  revalidatePath("/raket")
  revalidatePath("/dashboard")
  return { ok: true }
}

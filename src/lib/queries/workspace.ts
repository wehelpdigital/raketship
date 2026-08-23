import "server-only"

import { cache } from "react"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import type {
  FlowEdgeRow,
  FlowNodeRow,
  FlowRow,
  ModuleRow,
  ModuleTierRow,
  PlanRow,
  ProfileRow,
  RaketRow,
  SubscriptionRow,
  UserModuleRow,
} from "@/lib/supabase/types"

export interface ActivatedModule extends UserModuleRow {
  module: ModuleRow | null
  tier: ModuleTierRow | null
}

export interface WorkspaceSummary {
  profile: ProfileRow | null
  subscription: (SubscriptionRow & { plan: PlanRow | null }) | null
  modules: ActivatedModule[]
  raket: RaketRow | null
}

/**
 * Everything the shell needs for one signed-in user, in as few round-trips as
 * the PostgREST embed syntax allows.
 *
 * Returns nulls rather than throwing when the schema has not been applied yet,
 * so a fresh project shows the setup screen instead of a stack trace.
 */
export const getWorkspace = cache(async function getWorkspace(
  userId: string
): Promise<WorkspaceSummary> {
  const supabase = await getSupabaseServerClient()
  const empty: WorkspaceSummary = {
    profile: null,
    subscription: null,
    modules: [],
    raket: null,
  }
  if (!supabase) return empty

  const [profileRes, subRes, modulesRes, raketRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("subscriptions")
      .select("*, plan:plans(*)")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_modules")
      .select("*, module:modules(*), tier:module_tiers(*)")
      .eq("user_id", userId),
    supabase
      .from("rakets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  return {
    profile: (profileRes.data as ProfileRow | null) ?? null,
    subscription:
      (subRes.data as (SubscriptionRow & { plan: PlanRow | null }) | null) ??
      null,
    modules: ((modulesRes.data as ActivatedModule[] | null) ?? []).sort(
      (a, b) => (a.module?.sort_order ?? 0) - (b.module?.sort_order ?? 0)
    ),
    raket: (raketRes.data as RaketRow | null) ?? null,
  }
})

export interface CanvasPayload {
  flow: FlowRow | null
  nodes: FlowNodeRow[]
  edges: FlowEdgeRow[]
}

/** The outer "Build your Raket" canvas for a raket. */
export async function getRaketCanvas(
  raketId: string
): Promise<CanvasPayload> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { flow: null, nodes: [], edges: [] }

  const { data: flow } = await supabase
    .from("flows")
    .select("*")
    .eq("raket_id", raketId)
    .eq("kind", "raket")
    .maybeSingle()

  if (!flow) return { flow: null, nodes: [], edges: [] }
  return loadCanvasContents(flow as FlowRow)
}

/** The inner canvas belonging to one module node on the outer canvas. */
export async function getModuleCanvas(
  parentNodeId: string
): Promise<CanvasPayload> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { flow: null, nodes: [], edges: [] }

  const { data: flow } = await supabase
    .from("flows")
    .select("*")
    .eq("parent_node_id", parentNodeId)
    .maybeSingle()

  if (!flow) return { flow: null, nodes: [], edges: [] }
  return loadCanvasContents(flow as FlowRow)
}

async function loadCanvasContents(flow: FlowRow): Promise<CanvasPayload> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { flow, nodes: [], edges: [] }

  const [nodesRes, edgesRes] = await Promise.all([
    supabase
      .from("flow_nodes")
      .select("*")
      .eq("flow_id", flow.id)
      .order("position_y", { ascending: true }),
    supabase.from("flow_edges").select("*").eq("flow_id", flow.id),
  ])

  return {
    flow,
    nodes: (nodesRes.data as FlowNodeRow[] | null) ?? [],
    edges: (edgesRes.data as FlowEdgeRow[] | null) ?? [],
  }
}

/**
 * The module node a user placed on their raket, found by module slug rather
 * than by row id — which is what lets /modules/booking be a stable URL instead
 * of leaking a uuid into navigation.
 */
export const getModuleNodeForUser = cache(async function getModuleNodeForUser(
  userId: string,
  moduleId: string
): Promise<FlowNodeRow | null> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null
  const { data } = await supabase
    .from("flow_nodes")
    .select("*")
    .eq("user_id", userId)
    .eq("module_id", moduleId)
    .eq("type", "module")
    .limit(1)
    .maybeSingle()
  return (data as FlowNodeRow | null) ?? null
})

/** Find the module node on the outer canvas by its database id. */
export async function getModuleNode(
  nodeId: string
): Promise<FlowNodeRow | null> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null
  const { data } = await supabase
    .from("flow_nodes")
    .select("*")
    .eq("id", nodeId)
    .maybeSingle()
  return (data as FlowNodeRow | null) ?? null
}

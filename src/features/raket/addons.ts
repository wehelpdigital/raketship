"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server"

export interface AddonActionResult {
  ok: boolean
  message?: string
}

const fail = (message: string): AddonActionResult => ({ ok: false, message })

/**
 * An add-on: a module that ships as a follow-on to something the raket
 * already has, switched from My raket parts without spending a plan slot.
 *
 * Each one owns no tables — it is a way of READING or SHOWING what is
 * already there — so switching it on is three rows: the activated-module row
 * (the nav follows on its own), a node on the raket board, and a wire from
 * the module it serves. Off removes all three and touches nothing else.
 */
interface AddonSpec {
  moduleId: string
  nodeKey: string
  /** The node this add-on hangs off — where its wire comes FROM. */
  sourceKey: string
  label: string
  /** Where the node lands when its source is missing. */
  fallback: { x: number; y: number }
  /** Offset from the source node. */
  offset: { x: number; y: number }
  pagePath: string
  onMessage: string
  offMessage: string
}

const ADDONS: Record<string, AddonSpec> = {
  "client-manager": {
    moduleId: "client-manager",
    nodeKey: "module-client-manager",
    // It catches what Booking brings in, so it hangs off Booking.
    sourceKey: "module-booking",
    label: "Client Manager",
    fallback: { x: 40, y: 440 },
    offset: { x: 0, y: 230 },
    pagePath: "/modules/client-manager",
    onMessage:
      "Bukas na ang Client Manager — nasa navigation at nasa raket board mo na.",
    offMessage: "Sarado na ang Client Manager. Buo pa rin ang mga booking mo.",
  },
  website: {
    moduleId: "website",
    nodeKey: "module-website",
    // A website is the business SHOWING itself, so it hangs off the start
    // node — not off Booking.
    sourceKey: "start",
    label: "Website",
    // The start card fans: Booking down-left, Website down-right.
    fallback: { x: 230, y: 234 },
    offset: { x: 190, y: 210 },
    pagePath: "/modules/website",
    onMessage: "Bukas na ang Website — nasa raket board mo na, mula sa negosyo mo.",
    offMessage: "Sarado na ang Website.",
  },
}

async function setAddon(
  moduleId: string,
  on: boolean
): Promise<AddonActionResult> {
  const spec = ADDONS[moduleId]
  if (!spec || typeof on !== "boolean") {
    return fail("Hindi malinaw ang setting.")
  }

  const user = await getCurrentUser()
  if (!user) return fail("Please sign in again, then retry.")
  const db = await getSupabaseServerClient()
  if (!db) return fail("The database is not connected yet.")

  if (on) {
    const { error: moduleError } = await db.from("user_modules").upsert(
      {
        user_id: user.id,
        module_id: spec.moduleId,
        status: "active",
      },
      { onConflict: "user_id,module_id", ignoreDuplicates: true }
    )
    if (moduleError) return fail("Hindi na-activate. Pakisubukan ulit.")

    // The outer board, if the account has one. An account provisioned before
    // the canvas existed simply gets the module with no node.
    const { data: flow } = await db
      .from("flows")
      .select("id")
      .eq("user_id", user.id)
      .eq("kind", "raket")
      .maybeSingle()

    if (flow) {
      const { data: source } = await db
        .from("flow_nodes")
        .select("position_x, position_y")
        .eq("flow_id", flow.id)
        .eq("node_key", spec.sourceKey)
        .maybeSingle()

      const x = source ? source.position_x + spec.offset.x : spec.fallback.x
      const y = source ? source.position_y + spec.offset.y : spec.fallback.y

      const { error: nodeError } = await db.from("flow_nodes").upsert(
        {
          flow_id: flow.id,
          user_id: user.id,
          node_key: spec.nodeKey,
          type: "module",
          module_id: spec.moduleId,
          position_x: x,
          position_y: y,
          data: { label: spec.label },
        },
        { onConflict: "flow_id,node_key", ignoreDuplicates: true }
      )
      if (nodeError) return fail("Hindi na-activate. Pakisubukan ulit.")

      if (source) {
        await db.from("flow_edges").upsert(
          {
            flow_id: flow.id,
            user_id: user.id,
            edge_key: `${spec.sourceKey}->${spec.nodeKey}`,
            source_key: spec.sourceKey,
            target_key: spec.nodeKey,
          },
          { onConflict: "flow_id,edge_key", ignoreDuplicates: true }
        )
      }
    }
  } else {
    const { error } = await db
      .from("user_modules")
      .delete()
      .eq("user_id", user.id)
      .eq("module_id", spec.moduleId)
    if (error) return fail("Hindi na-deactivate. Pakisubukan ulit.")

    const { data: flow } = await db
      .from("flows")
      .select("id")
      .eq("user_id", user.id)
      .eq("kind", "raket")
      .maybeSingle()

    if (flow) {
      // Edges first: they reference the node only by key, so nothing cascades.
      await db
        .from("flow_edges")
        .delete()
        .eq("flow_id", flow.id)
        .eq("user_id", user.id)
        .or(`source_key.eq.${spec.nodeKey},target_key.eq.${spec.nodeKey}`)
      await db
        .from("flow_nodes")
        .delete()
        .eq("flow_id", flow.id)
        .eq("user_id", user.id)
        .eq("node_key", spec.nodeKey)
    }
  }

  revalidatePath("/", "layout")
  revalidatePath("/raket")
  revalidatePath(spec.pagePath)

  return { ok: true, message: on ? spec.onMessage : spec.offMessage }
}

export async function setClientManager(
  on: boolean
): Promise<AddonActionResult> {
  return setAddon("client-manager", on)
}

export async function setWebsite(on: boolean): Promise<AddonActionResult> {
  return setAddon("website", on)
}

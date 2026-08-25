"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server"

export interface ClientsActionResult {
  ok: boolean
  message?: string
}

const fail = (message: string): ClientsActionResult => ({ ok: false, message })

const NODE_KEY = "module-client-manager"
const BOOKING_NODE_KEY = "module-booking"

/**
 * Switch the Client Manager on or off.
 *
 * On: an activated-module row (so the nav and the marketplace both know), a
 * node on the raket board, and a wire from Booking into it — because that is
 * what it IS: the thing that catches what Booking brings in. Off: all three
 * go; the bookings the list was derived from are untouched, so switching back
 * on loses nothing.
 *
 * Deliberately NOT the marketplace's activateModule(): that one spends a
 * plan's module slot, and this is not a separate raket — it is what happens
 * AFTER a booking. The switch lives in Booking's What's next tab and should
 * work on every plan.
 *
 * Every write is scoped by user_id on top of RLS, and the whole thing is
 * idempotent: flipping a switch twice must land where flipping it once did.
 */
export async function setClientManager(
  on: boolean
): Promise<ClientsActionResult> {
  if (typeof on !== "boolean") return fail("Hindi malinaw ang setting.")

  const user = await getCurrentUser()
  if (!user) return fail("Please sign in again, then retry.")
  const db = await getSupabaseServerClient()
  if (!db) return fail("The database is not connected yet.")

  if (on) {
    const { error: moduleError } = await db.from("user_modules").upsert(
      {
        user_id: user.id,
        module_id: "client-manager",
        status: "active",
      },
      { onConflict: "user_id,module_id", ignoreDuplicates: true }
    )
    if (moduleError) {
      return fail("Hindi na-activate. Pakisubukan ulit.")
    }

    // The outer board, if the account has one. An account provisioned before
    // the canvas existed simply gets the module with no node — the list still
    // works, and ensureWorkspace will not be fought here.
    const { data: flow } = await db
      .from("flows")
      .select("id")
      .eq("user_id", user.id)
      .eq("kind", "raket")
      .maybeSingle()

    if (flow) {
      const { data: bookingNode } = await db
        .from("flow_nodes")
        .select("position_x, position_y")
        .eq("flow_id", flow.id)
        .eq("node_key", BOOKING_NODE_KEY)
        .maybeSingle()

      // Below Booking, the same step provisioning uses between its nodes.
      const x = bookingNode ? bookingNode.position_x : 40
      const y = bookingNode ? bookingNode.position_y + 160 : 344

      const { error: nodeError } = await db.from("flow_nodes").upsert(
        {
          flow_id: flow.id,
          user_id: user.id,
          node_key: NODE_KEY,
          type: "module",
          module_id: "client-manager",
          position_x: x,
          position_y: y,
          data: { label: "Client Manager" },
        },
        { onConflict: "flow_id,node_key", ignoreDuplicates: true }
      )
      if (nodeError) return fail("Hindi na-activate. Pakisubukan ulit.")

      if (bookingNode) {
        await db.from("flow_edges").upsert(
          {
            flow_id: flow.id,
            user_id: user.id,
            edge_key: `${BOOKING_NODE_KEY}->${NODE_KEY}`,
            source_key: BOOKING_NODE_KEY,
            target_key: NODE_KEY,
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
      .eq("module_id", "client-manager")
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
        .or(`source_key.eq.${NODE_KEY},target_key.eq.${NODE_KEY}`)
      await db
        .from("flow_nodes")
        .delete()
        .eq("flow_id", flow.id)
        .eq("user_id", user.id)
        .eq("node_key", NODE_KEY)
    }
  }

  // The nav lives in the layout, the node on the board, the list on its page.
  revalidatePath("/", "layout")
  revalidatePath("/raket")
  revalidatePath("/modules/client-manager")

  return {
    ok: true,
    message: on
      ? "Bukas na ang Client Manager — nasa navigation at nasa raket board mo na."
      : "Sarado na ang Client Manager. Buo pa rin ang mga booking mo.",
  }
}

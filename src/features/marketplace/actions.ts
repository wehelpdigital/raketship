"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server"

interface ActionResult {
  ok: boolean
  message: string
}

type Db = NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>

type Session =
  | { ok: true; userId: string; supabase: Db }
  | { ok: false; result: ActionResult }

function fail(message: string): ActionResult {
  return { ok: false, message }
}

function done(message: string): ActionResult {
  return { ok: true, message }
}

function slotWord(n: number): string {
  return n === 1 ? "slot" : "slots"
}

/** Every surface that shows module state has to re-render after a write. */
function refresh(): void {
  revalidatePath("/marketplace")
  // Most of these writes are triggered *from* a module page, and a plain
  // revalidatePath does not reach a dynamic segment.
  revalidatePath("/marketplace/[moduleId]", "page")
  revalidatePath("/dashboard")
  revalidatePath("/raket")
}

/**
 * Identity is always re-derived from the session cookie — an id arriving from
 * the client is data, never proof of who is asking.
 */
async function session(): Promise<Session> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      ok: false,
      result: fail("We couldn't tell who you are. Please sign in again."),
    }
  }
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return {
      ok: false,
      result: fail(
        "RaketShip isn't connected to its database yet, so nothing was saved."
      ),
    }
  }
  return { ok: true, userId: user.id, supabase }
}

async function loadPlans(supabase: Db, userId: string) {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id")
    .eq("user_id", userId)
    .maybeSingle()

  const { data: rows } = await supabase
    .from("plans")
    .select("id, name, module_slots")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  const plans = rows ?? []
  const current = plans.find((p) => p.id === sub?.plan_id) ?? plans[0] ?? null
  return { current, plans }
}

/** Activate a module at its lowest tier, within the plan's slot budget. */
export async function activateModule(moduleId: string): Promise<ActionResult> {
  const s = await session()
  if (!s.ok) return s.result
  const { userId, supabase } = s

  const { data: mod } = await supabase
    .from("modules")
    .select("id, name, is_available")
    .eq("id", moduleId)
    .maybeSingle()

  if (!mod) return fail("We couldn't find that module.")
  if (!mod.is_available) {
    return fail(
      `${mod.name} is still coming soon — we'll tell you the moment it lands.`
    )
  }

  const { data: ownedRows } = await supabase
    .from("user_modules")
    .select("module_id, status")
    .eq("user_id", userId)

  const owned = ownedRows ?? []
  if (owned.some((row) => row.module_id === moduleId)) {
    return done(`${mod.name} is already part of your raket.`)
  }

  const activeCount = owned.filter((row) => row.status === "active").length
  const { current, plans } = await loadPlans(supabase, userId)
  const slots = current?.module_slots ?? 1

  if (activeCount >= slots) {
    const planName = current?.name ?? "Libre"
    const roomier = plans.find((p) => p.module_slots > slots)
    const opener = `You're using all ${slots} module ${slotWord(slots)} on ${planName}.`
    return fail(
      roomier
        ? `${opener} Upgrade to ${roomier.name} for ${roomier.module_slots}.`
        : `${opener} Remove one you're not using to make room.`
    )
  }

  const { data: tier } = await supabase
    .from("module_tiers")
    .select("id, name")
    .eq("module_id", moduleId)
    .order("level", { ascending: true })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from("user_modules").insert({
    user_id: userId,
    module_id: moduleId,
    tier_id: tier?.id ?? null,
    status: "active",
  })

  if (error) return fail("We couldn't add that module. Please try again.")

  refresh()
  return done(
    tier
      ? `${mod.name} is in your raket, starting on ${tier.name}.`
      : `${mod.name} is in your raket.`
  )
}

/** Move a module up or down its own ladder. */
export async function setModuleTier(
  moduleId: string,
  tierId: string
): Promise<ActionResult> {
  const s = await session()
  if (!s.ok) return s.result
  const { userId, supabase } = s

  const { data: tier } = await supabase
    .from("module_tiers")
    .select("id, module_id, name, price_centavos")
    .eq("id", tierId)
    .maybeSingle()

  // A tier id from the client could point at any module's ladder, so confirm it
  // belongs to this one before it lands on the user's row.
  if (!tier || tier.module_id !== moduleId) {
    return fail("That tier doesn't belong to this module.")
  }

  const { data: owned } = await supabase
    .from("user_modules")
    .select("id, tier_id")
    .eq("user_id", userId)
    .eq("module_id", moduleId)
    .maybeSingle()

  if (!owned) return fail("Add this module to your raket first, then pick a tier.")
  if (owned.tier_id === tierId) return done(`You're already on ${tier.name}.`)

  const { error } = await supabase
    .from("user_modules")
    .update({ tier_id: tierId })
    .eq("id", owned.id)
    .eq("user_id", userId)

  if (error) return fail("We couldn't change that tier. Please try again.")

  refresh()
  return done(
    tier.price_centavos > 0
      ? `You're on ${tier.name} now. Walang bayad muna — billing isn't connected yet, so this is a simulated upgrade.`
      : `You're on ${tier.name} now.`
  )
}

/** Remove a module from the raket entirely. */
export async function deactivateModule(moduleId: string): Promise<ActionResult> {
  const s = await session()
  if (!s.ok) return s.result
  const { userId, supabase } = s

  const { data: mod } = await supabase
    .from("modules")
    .select("name")
    .eq("id", moduleId)
    .maybeSingle()

  const { error } = await supabase
    .from("user_modules")
    .delete()
    .eq("user_id", userId)
    .eq("module_id", moduleId)

  if (error) return fail("We couldn't remove that module. Please try again.")

  refresh()
  return done(
    `${mod?.name ?? "That module"} is out of your raket. Add it back anytime.`
  )
}

/** Switch subscription plans. No payment provider is wired up yet. */
export async function changePlan(planId: string): Promise<ActionResult> {
  const s = await session()
  if (!s.ok) return s.result
  const { userId, supabase } = s

  const { data: plan } = await supabase
    .from("plans")
    .select("id, name, module_slots, price_centavos")
    .eq("id", planId)
    .maybeSingle()

  if (!plan) return fail("We couldn't find that plan.")

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, plan_id")
    .eq("user_id", userId)
    .maybeSingle()

  if (sub?.plan_id === planId) return done(`You're already on ${plan.name}.`)

  const { data: ownedRows } = await supabase
    .from("user_modules")
    .select("status")
    .eq("user_id", userId)

  const activeCount = (ownedRows ?? []).filter(
    (row) => row.status === "active"
  ).length

  if (activeCount > plan.module_slots) {
    const excess = activeCount - plan.module_slots
    return fail(
      `${plan.name} has ${plan.module_slots} module ${slotWord(plan.module_slots)} and you have ${activeCount} running. Remove ${excess} first.`
    )
  }

  const { error } = sub
    ? await supabase
        .from("subscriptions")
        .update({ plan_id: planId, status: "active" })
        .eq("id", sub.id)
        .eq("user_id", userId)
    : await supabase
        .from("subscriptions")
        .insert({ user_id: userId, plan_id: planId, status: "active" })

  if (error) return fail("We couldn't switch your plan. Please try again.")

  refresh()
  const slotLine = `${plan.module_slots} module ${slotWord(plan.module_slots)}`
  return done(
    plan.price_centavos > 0
      ? `You're on ${plan.name} now — ${slotLine}. Simulated upgrade lang: nothing was charged, since payments aren't connected yet.`
      : `You're on ${plan.name} now — ${slotLine}.`
  )
}

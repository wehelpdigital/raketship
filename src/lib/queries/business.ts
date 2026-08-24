import "server-only"

import { cache } from "react"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import type { BusinessProfileRow } from "@/lib/supabase/types"

/**
 * Reading the business identity.
 *
 * Two callers with very different rights: the owner editing their own row, and
 * an anonymous visitor on /book/[slug] who is allowed to see it only because
 * the owner published a booking link. Both go through RLS; neither is trusted
 * with an id from the client.
 */

/** The owner's own row. Null when the schema or the row is missing. */
export const getBusinessProfile = cache(async function getBusinessProfile(
  userId: string
): Promise<BusinessProfileRow | null> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null

  const { data } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  return (data as BusinessProfileRow | null) ?? null
})

/**
 * Just the palette, for the app shell.
 *
 * Split out because the shell renders on every navigation and has no use for
 * an address or a payment note. Returns null rather than the default so the
 * caller can tell "no choice made" from "chose the brand red".
 */
export const getThemePreset = cache(async function getThemePreset(
  userId: string
): Promise<string | null> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null

  const { data } = await supabase
    .from("business_profiles")
    .select("theme_preset")
    .eq("user_id", userId)
    .maybeSingle()

  return (data as Pick<BusinessProfileRow, "theme_preset"> | null)?.theme_preset ?? null
})

/**
 * The business behind a public booking link.
 *
 * Scoped by the OWNER's id, which the caller reads off the calendar row it
 * already loaded — never off the request. The "published owner is public"
 * policy is what makes this return anything at all to a stranger, and it only
 * opens while that owner actually has a live calendar.
 */
export const getPublicBusinessProfile = cache(
  async function getPublicBusinessProfile(
    ownerId: string
  ): Promise<BusinessProfileRow | null> {
    const supabase = await getSupabaseServerClient()
    if (!supabase) return null

    const { data } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", ownerId)
      .maybeSingle()

    return (data as BusinessProfileRow | null) ?? null
  }
)

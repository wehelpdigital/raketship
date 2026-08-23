"use client"

import { createBrowserClient } from "@supabase/ssr"

import { env, supabaseConfigured } from "@/lib/env"
import type { Database } from "@/lib/supabase/types"

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null

/**
 * Browser Supabase client (singleton).
 *
 * Returns `null` when the project is unconfigured so callers can render a
 * setup prompt rather than throwing during render.
 */
export function getSupabaseBrowserClient() {
  if (!supabaseConfigured) return null
  if (!cached) {
    cached = createBrowserClient<Database>(
      env.supabaseUrl,
      env.supabasePublishableKey
    )
  }
  return cached
}

/** Throwing variant for call sites that have already checked configuration. */
export function requireSupabaseBrowserClient() {
  const client = getSupabaseBrowserClient()
  if (!client) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    )
  }
  return client
}

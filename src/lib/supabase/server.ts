import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

import { env, supabaseConfigured } from "@/lib/env"
import type { Database } from "@/lib/supabase/types"

/**
 * Server-side Supabase client bound to the request's cookie jar.
 * Returns `null` when unconfigured.
 */
export async function getSupabaseServerClient() {
  if (!supabaseConfigured) return null
  const cookieStore = await cookies()

  return createServerClient<Database>(
    env.supabaseUrl,
    env.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — the middleware refreshes the
            // session instead, so this is safe to ignore.
          }
        },
      },
    }
  )
}

/** Returns the signed-in user, or null. Never throws on missing config. */
export async function getCurrentUser() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

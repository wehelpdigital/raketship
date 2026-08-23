import "server-only"

import { createClient } from "@supabase/supabase-js"

import { serverEnv } from "@/lib/env"
import type { Database } from "@/lib/supabase/types"

/**
 * Service-role client. Bypasses RLS — only ever use inside route handlers or
 * server actions after you have authorised the caller yourself.
 */
export function getSupabaseAdminClient() {
  const { supabaseUrl, secretKey } = serverEnv()
  if (!supabaseUrl || !secretKey) return null

  return createClient<Database>(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

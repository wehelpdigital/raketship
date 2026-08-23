import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { AppHeader } from "@/components/shell/app-header"
import { BottomNav } from "@/components/shell/bottom-nav"
import { supabaseConfigured } from "@/lib/env"
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server"
import type { ProfileRow } from "@/lib/supabase/types"

/**
 * The profile row is the source of truth for the display name — auth metadata
 * only ever echoes what was typed at signup, so it goes stale the moment
 * someone renames themselves on /account.
 */
async function profileName(userId: string): Promise<string | null> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle()
  return (data as Pick<ProfileRow, "full_name"> | null)?.full_name ?? null
}

export default async function AppLayout({
  children,
}: {
  children: ReactNode
}) {
  // Without credentials there is no session to judge, and bouncing to /login
  // would only hide the setup instructions the pages themselves render.
  const user = supabaseConfigured ? await getCurrentUser() : null
  if (supabaseConfigured && !user) redirect("/login")

  const metadata = user?.user_metadata as
    | { full_name?: string | null }
    | undefined
  const name =
    (user ? await profileName(user.id) : null) ?? metadata?.full_name ?? null

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader name={name} email={user?.email ?? null} />
      <main className="flex-1">{children}</main>
      <BottomNav />
    </div>
  )
}

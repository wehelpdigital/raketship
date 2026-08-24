import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { AppHeader } from "@/components/shell/app-header"
import { BottomNav } from "@/components/shell/bottom-nav"
import { PaletteStyle } from "@/components/shell/palette-style"
import { SideNav, type ModuleNavItem } from "@/components/shell/side-nav"
import { supabaseConfigured } from "@/lib/env"
import { getThemePreset } from "@/lib/queries/business"
import { countUpcomingBookings } from "@/lib/queries/booking"
import { getWorkspace } from "@/lib/queries/workspace"
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

  // The Modules group is driven by what the user actually activated, so an
  // empty workspace simply renders the group's "No modules yet" state.
  const workspace = user ? await getWorkspace(user.id) : null

  // Read on the server and painted into the first byte of HTML. A branding
  // feature that flashes the default red before correcting itself is worse
  // than no branding at all, so there is no client-side apply here.
  const palette = user ? await getThemePreset(user.id) : null
  const modules: ModuleNavItem[] = (workspace?.modules ?? [])
    .filter((m) => m.status === "active" && m.module)
    .map((m) => ({
      id: m.module_id,
      name: m.module?.name ?? m.module_id,
      icon: m.module?.icon ?? "Boxes",
      accent: m.module?.accent ?? "chart-1",
      tier: m.tier?.name ?? null,
    }))


  /*
    Counts beside the module pages, keyed by sub-item id. A head count, so the
    shell pays for a number rather than for rows it will not render — and only
    for the modules the user actually has.
  */
  const hasBooking = modules.some((m) => m.id === "booking")
  const badges = {
    booked: hasBooking && user ? await countUpcomingBookings(user.id) : 0,
  }

  // Three navigation surfaces, exactly one visible per breakpoint:
  // phone -> BottomNav, tablet -> the header's inline row, desktop -> SideNav.
  return (
    <div className="min-h-dvh bg-background lg:pl-64">
      <PaletteStyle preset={palette} />
      <SideNav modules={modules} badges={badges} />
      <div className="flex min-h-dvh flex-col">
        <AppHeader
          name={name}
          email={user?.email ?? null}
          modules={modules}
          badges={badges}
        />
        <main className="flex-1">{children}</main>
      </div>
      <BottomNav />
    </div>
  )
}

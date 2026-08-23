import { redirect } from "next/navigation"

import { supabaseConfigured } from "@/lib/env"
import { getCurrentUser } from "@/lib/supabase/server"

export default async function RootPage() {
  // Before the keys are in, the dashboard is the useful landing spot: it walks
  // through setup instead of showing a sign-in form that cannot work yet.
  if (!supabaseConfigured) redirect("/dashboard")

  const user = await getCurrentUser()
  redirect(user ? "/dashboard" : "/login")
}

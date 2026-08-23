import "server-only"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import type { ModuleRow, ModuleTierRow, PlanRow } from "@/lib/supabase/types"

export interface CatalogModule extends ModuleRow {
  tiers: ModuleTierRow[]
}

/** The marketplace catalogue: every module with its upgrade ladder. */
export async function getCatalog(): Promise<CatalogModule[]> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return []

  const { data } = await supabase
    .from("modules")
    .select("*, tiers:module_tiers(*)")
    .order("sort_order", { ascending: true })

  const modules = (data as CatalogModule[] | null) ?? []
  for (const m of modules) {
    m.tiers = (m.tiers ?? []).sort((a, b) => a.level - b.level)
  }
  return modules
}

export async function getModule(
  moduleId: string
): Promise<CatalogModule | null> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null

  const { data } = await supabase
    .from("modules")
    .select("*, tiers:module_tiers(*)")
    .eq("id", moduleId)
    .maybeSingle()

  if (!data) return null
  const module = data as CatalogModule
  module.tiers = (module.tiers ?? []).sort((a, b) => a.level - b.level)
  return module
}

export async function getPlans(): Promise<PlanRow[]> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return []
  const { data } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
  return (data as PlanRow[] | null) ?? []
}

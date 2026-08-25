import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageContainer, PageHeader } from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import { PartsList } from "@/features/raket/parts-list"
import { supabaseConfigured } from "@/lib/env"
import { getCatalog } from "@/lib/queries/catalog"
import { getWorkspace } from "@/lib/queries/workspace"
import { getCurrentUser } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "My raket parts",
  description: "Ang mga module ng raket mo — dito sila binubuksan at ina-upgrade.",
}

/**
 * Every part of the raket, and the levers for each.
 *
 * One page for "what is my raket made of": which modules are on, at which
 * tier, and the switch or button that changes that. A static segment beside
 * /raket/[nodeId] — "parts" can never be a node id, node ids are uuids.
 *
 * The marketplace stays the place to SHOP; this is the place to MANAGE what
 * is already yours. The two share their actions, so neither can drift from
 * the other about what activation means.
 */
export default async function RaketPartsPage() {
  const user = await getCurrentUser()

  if (!supabaseConfigured || !user) {
    return (
      <PageContainer>
        <PageHeader
          title="My raket parts"
          description="Ang mga module ng raket mo — dito sila binubuksan at ina-upgrade."
        />
        <SetupNotice />
      </PageContainer>
    )
  }

  const [catalog, workspace] = await Promise.all([
    getCatalog(),
    getWorkspace(user.id),
  ])

  const activatedByModule = new Map(
    workspace.modules.map((activated) => [activated.module_id, activated])
  )

  const rows = catalog
    .filter((mod) => mod.is_available || activatedByModule.has(mod.id))
    .map((mod) => {
      const activated = activatedByModule.get(mod.id)
      return {
        id: mod.id,
        name: mod.name,
        tagline: mod.tagline,
        icon: mod.icon,
        accent: mod.accent,
        isDefault: mod.is_default,
        active: activated?.status === "active",
        tierId: activated?.tier_id ?? null,
        tiers: mod.tiers.map((tier) => ({
          id: tier.id,
          name: tier.name,
          priceCentavos: tier.price_centavos,
          level: tier.level,
        })),
      }
    })

  return (
    <PageContainer>
      <div className="space-y-4">
        <Link
          href="/raket"
          className="-ml-2 inline-flex h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Build your Raket
        </Link>

        <PageHeader
          title="My raket parts"
          description="Ang mga module ng raket mo — dito sila binubuksan at ina-upgrade."
        />
      </div>

      <PartsList rows={rows} />
    </PageContainer>
  )
}

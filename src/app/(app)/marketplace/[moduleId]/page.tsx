import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, Lock } from "lucide-react"

import { PageContainer } from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import { Badge } from "@/components/ui/badge"
import { ActivateButton } from "@/features/marketplace/activate-button"
import { ModuleIcon } from "@/components/module-icon"
import { accentChip } from "@/features/marketplace/module-card"
import { TierLadder } from "@/features/marketplace/tier-ladder"
import { supabaseConfigured } from "@/lib/env"
import { resolveNodeType } from "@/lib/flow/registry"
import { getModule } from "@/lib/queries/catalog"
import { getWorkspace } from "@/lib/queries/workspace"
import { getCurrentUser } from "@/lib/supabase/server"
import type { ModuleTierRow } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

interface PageProps {
  params: Promise<{ moduleId: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { moduleId } = await params
  if (!supabaseConfigured) return { title: "Module" }
  const mod = await getModule(moduleId)
  if (!mod) return { title: "Module" }
  return { title: mod.name, description: mod.tagline ?? undefined }
}

function BackLink() {
  return (
    <Link
      href="/marketplace"
      className="-ml-2 inline-flex h-11 w-fit items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ChevronLeft className="size-4" aria-hidden="true" />
      Marketplace
    </Link>
  )
}

/** jsonb, so anything that is not an array of strings unlocks nothing. */
function nodeTypeList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string")
}

/** First tier on the ladder that unlocks each builder element. */
function unlockMap(tiers: ModuleTierRow[]): Map<string, ModuleTierRow> {
  const map = new Map<string, ModuleTierRow>()
  for (const tier of tiers) {
    for (const type of nodeTypeList(tier.node_types)) {
      if (!map.has(type)) map.set(type, tier)
    }
  }
  return map
}

export default async function ModulePage({ params }: PageProps) {
  const { moduleId } = await params

  if (!supabaseConfigured) {
    return (
      <PageContainer>
        <BackLink />
        <SetupNotice reason="unconfigured" />
      </PageContainer>
    )
  }

  const mod = await getModule(moduleId)
  if (!mod) notFound()

  const user = await getCurrentUser()
  const workspace = user ? await getWorkspace(user.id) : null
  const ownedRow =
    workspace?.modules.find((m) => m.module_id === mod.id) ?? null

  const unlockedTypes = new Set(nodeTypeList(ownedRow?.tier?.node_types))
  const tiers = Array.isArray(mod.tiers) ? mod.tiers : []
  const unlocks = Array.from(unlockMap(tiers).entries())

  return (
    <PageContainer>
      <BackLink />

      <header className="space-y-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-14 shrink-0 items-center justify-center rounded-xl",
              accentChip(mod.accent)
            )}
          >
            <ModuleIcon name={mod.icon} className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
              {mod.name}
            </h2>
            {mod.tagline ? (
              <p className="text-sm text-pretty text-muted-foreground">
                {mod.tagline}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!mod.is_available ? (
            <Badge variant="ghost">Coming soon</Badge>
          ) : ownedRow ? (
            <Badge>
              {ownedRow.tier?.name ? `Active · ${ownedRow.tier.name}` : "Active"}
            </Badge>
          ) : (
            <Badge variant="outline">Available</Badge>
          )}
        </div>

        {mod.description ? (
          <p className="text-sm text-pretty text-muted-foreground">
            {mod.description}
          </p>
        ) : null}

        <ActivateButton
          moduleId={mod.id}
          moduleName={mod.name}
          owned={ownedRow !== null}
          available={mod.is_available}
        />
      </header>

      {unlocks.length > 0 && (
        <section className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold tracking-tight">
              What you can build
            </h3>
            <p className="text-sm text-pretty text-muted-foreground">
              These are the steps you can drag onto this module&apos;s canvas.
            </p>
          </div>
          <ul className="space-y-3">
            {unlocks.map(([type, tier]) => {
              const def = resolveNodeType(type)
              const unlocked = unlockedTypes.has(type)

              return (
                <li
                  key={type}
                  className="flex items-start gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      accentChip(def.accent),
                      !unlocked && "opacity-70"
                    )}
                  >
                    <ModuleIcon name={def.icon} className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {def.label}
                      </p>
                      {!unlocked && (
                        <Lock
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <p className="text-sm text-pretty text-muted-foreground">
                      {def.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {unlocked
                        ? "Ready to drop on your canvas"
                        : `Unlocks with ${tier.name}`}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold tracking-tight">
            Pick your notch
          </h3>
          <p className="text-sm text-pretty text-muted-foreground">
            Start small. Move up only when {mod.name} needs to do more.
          </p>
        </div>
        <TierLadder
          moduleId={mod.id}
          moduleName={mod.name}
          tiers={tiers}
          owned={ownedRow !== null}
          ownedTierId={ownedRow?.tier_id ?? null}
        />
      </section>
    </PageContainer>
  )
}

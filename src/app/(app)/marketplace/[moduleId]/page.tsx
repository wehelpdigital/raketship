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
import { cn, formatPeso } from "@/lib/utils"

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

function priceLabel(centavos: number): string {
  return centavos <= 0 ? "Free" : formatPeso(centavos)
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
  const hasUnlocks = unlocks.length > 0

  // The buy box quotes what the user is on once they own the module, and the
  // cheapest rung of the ladder before that.
  const currentTier = ownedRow?.tier ?? null
  const lowest =
    tiers.length > 0 ? Math.min(...tiers.map((t) => t.price_centavos)) : null
  const quoted = currentTier ? currentTier.price_centavos : lowest

  return (
    <PageContainer>
      <BackLink />

      {/* One column on phone and tablet. At desktop the pitch takes a wide
          left column and the action moves into a sticky buy box on the right,
          which the aside's two-row placement keeps in view down the whole page. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:items-start lg:gap-8">
        <header className="space-y-3 lg:col-span-2 lg:space-y-4">
          <div className="flex items-start gap-3 lg:gap-5">
            <span
              className={cn(
                "flex size-14 shrink-0 items-center justify-center rounded-xl lg:size-20 lg:rounded-2xl",
                accentChip(mod.accent)
              )}
            >
              <ModuleIcon
                name={mod.icon}
                className="size-6 lg:size-9"
                aria-hidden="true"
              />
            </span>
            <div className="min-w-0 space-y-1 lg:space-y-2">
              <h2 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl lg:text-3xl">
                {mod.name}
              </h2>
              {mod.tagline ? (
                <p className="max-w-prose text-sm text-pretty text-muted-foreground lg:text-base">
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
                {ownedRow.tier?.name
                  ? `Active · ${ownedRow.tier.name}`
                  : "Active"}
              </Badge>
            ) : (
              <Badge variant="outline">Available</Badge>
            )}
          </div>

          {mod.description ? (
            <p className="max-w-prose text-sm text-pretty text-muted-foreground lg:text-base">
              {mod.description}
            </p>
          ) : null}
        </header>

        <aside
          className={cn(
            "lg:sticky lg:top-24 lg:col-start-3 lg:row-start-1 lg:self-start",
            hasUnlocks && "lg:row-end-3"
          )}
        >
          <div className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5 lg:p-6">
            <div className="space-y-1">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {currentTier ? "Your notch" : "Starts at"}
              </p>
              <p className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-2xl font-semibold tabular-nums text-foreground lg:text-3xl">
                  {quoted === null ? "Pricing soon" : priceLabel(quoted)}
                </span>
                {quoted !== null && quoted > 0 && (
                  <span className="text-sm text-muted-foreground">
                    per month
                  </span>
                )}
              </p>
              {currentTier ? (
                <p className="text-sm text-muted-foreground">
                  You are on {currentTier.name}.
                </p>
              ) : tiers.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tiers.length} {tiers.length === 1 ? "notch" : "notches"} on
                  this ladder.
                </p>
              ) : null}
            </div>

            <ActivateButton
              moduleId={mod.id}
              moduleName={mod.name}
              owned={ownedRow !== null}
              available={mod.is_available}
            />

            {mod.is_available && tiers.length > 0 && (
              <p className="text-xs text-pretty text-muted-foreground">
                Move between notches anytime from the ladder below.
              </p>
            )}
          </div>
        </aside>

        {hasUnlocks && (
          <section className="space-y-3 lg:col-span-2 lg:row-start-2 lg:space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold tracking-tight lg:text-base">
                What you can build
              </h3>
              <p className="max-w-prose text-sm text-pretty text-muted-foreground">
                These are the steps you can drag onto this module&apos;s canvas.
              </p>
            </div>
            {/* Two across from tablet — these repeat, and one per row wastes
                the width the page has from md onward. */}
            <ul className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
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
                        "flex size-9 shrink-0 items-center justify-center rounded-lg lg:size-10",
                        accentChip(def.accent),
                        !unlocked && "opacity-70"
                      )}
                    >
                      <ModuleIcon
                        name={def.icon}
                        className="size-4 lg:size-5"
                        aria-hidden="true"
                      />
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
      </div>

      {/* Full width, below both columns: three tiers side by side is the whole
          point of the ladder, and it needs the room to compare. */}
      <section className="space-y-3 lg:space-y-6">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold tracking-tight lg:text-base">
            Pick your notch
          </h3>
          <p className="max-w-prose text-sm text-pretty text-muted-foreground">
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

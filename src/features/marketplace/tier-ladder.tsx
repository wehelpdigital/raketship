"use client"

import { useState, useTransition } from "react"
import { Check, LoaderCircle, Lock } from "lucide-react"
import { toast } from "sonner"

import { setModuleTier } from "@/features/marketplace/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ModuleTierRow } from "@/lib/supabase/types"
import { cn, formatPeso } from "@/lib/utils"

const ROLLUP = /^everything in\b/i

function normalise(value: string): string {
  return value.trim().toLowerCase()
}

/** features is jsonb, so a hand-written row can hold anything. */
function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string")
}

/**
 * What this tier adds over the one below it. Seed data leads each list with an
 * "Everything in X" line; the delta is the actual sales pitch, so that rollup
 * and anything already carried up is dropped.
 */
export function deltaFeatures(
  features: readonly string[],
  previous: readonly string[] = []
): string[] {
  const list = stringList(features)
  const seen = new Set(stringList(previous).map(normalise))
  const added: string[] = []
  for (const feature of list) {
    if (ROLLUP.test(feature.trim())) continue
    const key = normalise(feature)
    if (seen.has(key)) continue
    seen.add(key)
    added.push(feature)
  }
  return added
}

export type TierState = "locked" | "included" | "current" | "upgrade"

export function tierState(
  tierId: string,
  tierLevel: number,
  opts: { owned: boolean; ownedTierId: string | null; ownedLevel: number | null }
): TierState {
  if (!opts.owned) return "locked"
  if (tierId === opts.ownedTierId) return "current"
  if (opts.ownedLevel !== null && tierLevel < opts.ownedLevel) return "included"
  return "upgrade"
}

function priceLabel(centavos: number): string {
  return centavos <= 0 ? "Free" : formatPeso(centavos)
}

/**
 * Three notches is what every seeded module ships, but the schema allows
 * fewer — and a short ladder dropped into a fixed three-column grid would
 * leave a hole. Static strings, because Tailwind cannot see an interpolated
 * class name.
 */
const LADDER_COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
}

/**
 * Button is `whitespace-nowrap` by default and these cards are barely 170px
 * wide once the ladder goes three across, so "Move back down to Starter"
 * would spill. Wrap instead; min-h-11 keeps the phone tap target.
 */
const LADDER_ACTION =
  "mt-3 h-auto min-h-11 w-full py-2 text-center whitespace-normal"

export interface TierLadderProps {
  moduleId: string
  moduleName: string
  tiers: ModuleTierRow[]
  owned: boolean
  ownedTierId: string | null
}

export function TierLadder({
  moduleId,
  moduleName,
  tiers,
  owned,
  ownedTierId,
}: TierLadderProps) {
  const [target, setTarget] = useState<ModuleTierRow | null>(null)
  const [pending, startTransition] = useTransition()

  if (tiers.length === 0) {
    return (
      <p className="max-w-prose text-sm text-pretty text-muted-foreground">
        This module has no tiers yet. Check back soon.
      </p>
    )
  }

  const ownedLevel = tiers.find((t) => t.id === ownedTierId)?.level ?? null

  function applyTier() {
    if (!target) return
    const tier = target
    startTransition(async () => {
      const result = await setModuleTier(moduleId, tier.id)
      if (result.ok) toast.success(result.message)
      else toast.error(result.message)
      setTarget(null)
    })
  }

  const movingUp =
    target !== null && (ownedLevel === null || target.level > ownedLevel)

  return (
    <>
      {!owned && (
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          Add {moduleName} to your raket first — then you can climb this ladder
          one notch at a time.
        </p>
      )}

      {/* A stacked ladder on phone; three columns at desktop so Starter, Plus
          and Pro can be read against each other. */}
      <ul
        className={cn(
          "space-y-3 lg:grid lg:items-stretch lg:gap-6 lg:space-y-0",
          LADDER_COLUMNS[tiers.length] ?? "lg:grid-cols-3"
        )}
      >
        {tiers.map((tier, index) => {
          const previous = index > 0 ? tiers[index - 1] : undefined
          const added = deltaFeatures(tier.features, previous?.features)
          const state = tierState(tier.id, tier.level, {
            owned,
            ownedTierId,
            ownedLevel,
          })

          return (
            <li
              key={tier.id}
              className={cn(
                "rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5 lg:flex lg:h-full lg:flex-col lg:p-6",
                state === "current" && "ring-2 ring-primary",
                state === "included" && "opacity-80"
              )}
            >
              {/* Name beside price on phone; price under the name in a column,
                  where that horizontal room is gone. */}
              <div className="flex items-start justify-between gap-3 lg:flex-col lg:items-stretch">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium text-foreground lg:text-base">
                      {tier.name}
                    </h3>
                    {state === "current" && <Badge>Current</Badge>}
                    {state === "included" && (
                      <Badge variant="secondary">Included</Badge>
                    )}
                    {state === "locked" && (
                      <Lock
                        className="size-3.5 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  {tier.description ? (
                    <p className="max-w-prose text-sm text-pretty text-muted-foreground">
                      {tier.description}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right lg:mt-3 lg:text-left">
                  <span className="block text-base font-semibold tabular-nums text-foreground lg:text-3xl">
                    {priceLabel(tier.price_centavos)}
                  </span>
                  {tier.price_centavos > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      per month
                    </span>
                  )}
                </div>
              </div>

              {added.length > 0 && (
                <div className="mt-3 space-y-2 lg:mt-5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {previous ? `What ${tier.name} adds` : "What you get"}
                  </p>
                  <ul className="space-y-2">
                    {added.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-chart-3"
                          aria-hidden="true"
                        />
                        <span className="text-pretty">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {previous && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Plus everything in {previous.name}.
                </p>
              )}

              {/* mt-auto pins the action to the card floor so the three
                  columns line their buttons up. */}
              {state === "upgrade" && (
                <Button
                  className={cn(LADDER_ACTION, "lg:mt-auto")}
                  onClick={() => setTarget(tier)}
                  disabled={pending}
                >
                  {tier.price_centavos > 0
                    ? `Upgrade — ${formatPeso(tier.price_centavos)}/mo`
                    : `Switch to ${tier.name}`}
                </Button>
              )}

              {state === "included" && (
                <Button
                  variant="ghost"
                  className={cn(LADDER_ACTION, "text-muted-foreground lg:mt-auto")}
                  onClick={() => setTarget(tier)}
                  disabled={pending}
                >
                  Move back down to {tier.name}
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {movingUp ? "Upgrade" : "Move"} {moduleName} to{" "}
              {target?.name ?? ""}?
            </DialogTitle>
            <DialogDescription>
              {target && target.price_centavos > 0
                ? `${formatPeso(target.price_centavos)} a month on top of your plan. Payments are not connected yet, so this is a simulated upgrade — walang sisingilin sa iyo ngayon.`
                : "No extra cost. You can move up again whenever you need more."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setTarget(null)}
              disabled={pending}
            >
              Not yet
            </Button>
            <Button className="h-11" onClick={applyTier} disabled={pending}>
              {pending && (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              )}
              {movingUp ? "Confirm upgrade" : "Confirm change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

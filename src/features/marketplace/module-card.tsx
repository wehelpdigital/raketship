import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { ModuleIcon } from "@/components/module-icon"
import { Badge } from "@/components/ui/badge"
import type { ModuleRow } from "@/lib/supabase/types"
import { cn, formatPeso } from "@/lib/utils"

/**
 * Written out in full because Tailwind only ships classes it can see in the
 * source — `bg-chart-${n}/12` would compile to nothing.
 */
const ACCENT_CHIP: Record<string, string> = {
  "chart-1": "bg-chart-1/12 text-chart-1",
  "chart-2": "bg-chart-2/12 text-chart-2",
  "chart-3": "bg-chart-3/12 text-chart-3",
  "chart-4": "bg-chart-4/12 text-chart-4",
  "chart-5": "bg-chart-5/12 text-chart-5",
}

export function accentChip(accent: string): string {
  return ACCENT_CHIP[accent] ?? ACCENT_CHIP["chart-1"]
}

export function priceHint(fromCentavos: number | null): string {
  if (fromCentavos === null) return "Pricing soon"
  if (fromCentavos <= 0) return "From free"
  return `From ${formatPeso(fromCentavos)}/mo`
}

export interface ModuleCardProps {
  module: ModuleRow
  /** Cheapest tier on the ladder, in centavos. Null when it has no tiers yet. */
  fromCentavos: number | null
  owned?: boolean
  /** Name of the tier the user is on, when they own it. */
  activeTier?: string | null
}

export function ModuleCard({
  module,
  fromCentavos,
  owned = false,
  activeTier = null,
}: ModuleCardProps) {
  const soon = !module.is_available

  const chip = soon ? (
    <Badge variant="ghost">Coming soon</Badge>
  ) : owned ? (
    <Badge>{activeTier ? `Active · ${activeTier}` : "Active"}</Badge>
  ) : (
    <Badge variant="outline">Available</Badge>
  )

  const body = (
    <>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            accentChip(module.accent)
          )}
        >
          <ModuleIcon name={module.icon} className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="truncate text-sm font-medium text-foreground">
            {module.name}
          </h3>
          {module.tagline ? (
            <p className="line-clamp-2 text-sm text-pretty text-muted-foreground">
              {module.tagline}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {soon ? "Not open yet" : priceHint(fromCentavos)}
        </span>
        <span className="flex items-center gap-1">
          {chip}
          {!soon && (
            <ArrowUpRight
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </span>
      </div>
    </>
  )

  const base = "block rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5"

  if (soon) {
    return (
      <div className={cn(base, "opacity-60")} aria-disabled="true">
        {body}
      </div>
    )
  }

  return (
    <Link
      href={`/marketplace/${module.id}`}
      className={cn(
        base,
        "transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      )}
    >
      {body}
    </Link>
  )
}

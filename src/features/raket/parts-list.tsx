"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { ModuleIcon } from "@/components/module-icon"
import { accentChip } from "@/components/shell/module-nav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  setClientManager,
  setProductCatalog,
  setWebsite,
} from "@/features/raket/addons"
import {
  activateModule,
  deactivateModule,
} from "@/features/marketplace/actions"
import { cn } from "@/lib/utils"

/** The add-ons and their slot-free switches. One lever each, shared with
 *  nothing — a second path to the same rows would eventually disagree. */
const ADDON_ACTIONS: Record<
  string,
  (on: boolean) => Promise<{ ok: boolean; message?: string }>
> = {
  "client-manager": setClientManager,
  website: setWebsite,
  "product-catalog": setProductCatalog,
}

export interface PartRow {
  id: string
  name: string
  tagline: string | null
  icon: string
  accent: string
  isDefault: boolean
  active: boolean
  tierId: string | null
  tiers: { id: string; name: string; priceCentavos: number; level: number }[]
}

/**
 * The raket, part by part — a ruled, striped list like the Booked page.
 *
 * One row per module, and only the lever that fits it: a DEFAULT module is
 * part of every raket and carries no controls at all — its being here IS the
 * statement; the Client Manager keeps its slot-free switch; anything else
 * activates through the marketplace's own actions, slots and all. Tiers are
 * worn as a tag, not managed here — upgrading is the marketplace's
 * conversation, with prices and features in front of it.
 */
export function PartsList({ rows }: { rows: PartRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg bg-card px-4 py-10 text-center text-sm text-pretty text-muted-foreground ring-1 ring-border">
        Wala pang laman ang catalog. I-apply muna ang database migrations.
      </p>
    )
  }

  return (
    <div className="divide-y overflow-hidden rounded-lg bg-card ring-1 ring-border">
      {rows.map((row) => (
        <PartRowItem key={row.id} row={row} />
      ))}
    </div>
  )
}

function PartRowItem({ row }: { row: PartRow }) {
  const router = useRouter()
  const [busy, startBusy] = React.useTransition()

  function run(
    action: () => Promise<{ ok: boolean; message?: string }>,
    fallback: string
  ) {
    startBusy(async () => {
      try {
        const result = await action()
        if (!result.ok) {
          toast.error(result.message ?? fallback)
          return
        }
        if (result.message) toast.success(result.message)
        router.refresh()
      } catch {
        toast.error("Something went wrong. Pakisubukan ulit.")
      }
    })
  }

  const currentTier = row.tiers.find((tier) => tier.id === row.tierId)

  return (
    /*
      Striped: every second row takes a breath of muted, the same trick a
      ledger uses — the eye tracks a row across without a ruler.
    */
    <div className="flex items-center gap-3 px-4 py-4 even:bg-muted/30 lg:px-5">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          accentChip(row.accent)
        )}
      >
        <ModuleIcon name={row.icon} className="size-5" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{row.name}</p>
        {row.tagline ? (
          <p className="truncate text-xs text-muted-foreground">
            {row.tagline}
          </p>
        ) : null}
      </div>

      {/* The tier as its own column: worn, not managed — upgrading is the
          marketplace's conversation. */}
      {currentTier ? (
        <Badge
          variant="outline"
          className="shrink-0 rounded-full px-2.5 font-normal"
        >
          {currentTier.name}
        </Badge>
      ) : null}

      {/* The one lever that fits this module; a default carries none. */}
      {ADDON_ACTIONS[row.id] ? (
        <Switch
          checked={row.active}
          disabled={busy}
          onCheckedChange={(next) =>
            run(
              () => ADDON_ACTIONS[row.id](Boolean(next)),
              "Hindi na-save. Pakisubukan ulit."
            )
          }
          aria-label={row.name}
        />
      ) : row.isDefault ? null : row.active ? (
        <Button
          type="button"
          variant="ghost"
          className="h-9 shrink-0 px-3 text-muted-foreground hover:text-destructive"
          disabled={busy}
          onClick={() =>
            run(
              () => deactivateModule(row.id),
              "Hindi naalis. Pakisubukan ulit."
            )
          }
        >
          Alisin
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-9 shrink-0 px-3"
          disabled={busy}
          onClick={() =>
            run(
              () => activateModule(row.id),
              "Hindi na-activate. Pakisubukan ulit."
            )
          }
        >
          I-activate
        </Button>
      )}
    </div>
  )
}

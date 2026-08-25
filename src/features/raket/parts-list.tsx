"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { ModuleIcon } from "@/components/module-icon"
import { accentChip } from "@/components/shell/module-nav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { setClientManager } from "@/features/clients/actions"
import {
  activateModule,
  deactivateModule,
  setModuleTier,
} from "@/features/marketplace/actions"
import { cn, formatPeso } from "@/lib/utils"

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
 * The raket, part by part.
 *
 * One row per module, each with exactly the lever that fits it:
 * - a DEFAULT module is part of every raket and has no off switch — offering
 *   one would be offering a way to break the product;
 * - the Client Manager is a booking add-on, so its switch is the same
 *   slot-free one the What's next tab used to hold;
 * - everything else activates through the marketplace's own action, slots and
 *   all, so this page can never disagree with the market about what a plan
 *   allows.
 * A module with a ladder gets its tier select whenever it is active.
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
    <Card>
      <CardContent className="divide-y py-2 lg:py-3">
        {rows.map((row) => (
          <PartRowItem key={row.id} row={row} />
        ))}
      </CardContent>
    </Card>
  )
}

function PartRowItem({ row }: { row: PartRow }) {
  const router = useRouter()
  const [busy, startBusy] = React.useTransition()
  const uid = React.useId()

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
    <div className="space-y-3 py-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            accentChip(row.accent)
          )}
        >
          <ModuleIcon name={row.icon} className="size-5" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-sm font-medium">{row.name}</p>
            {row.isDefault ? (
              <Badge variant="outline" className="font-normal">
                Kasama lagi
              </Badge>
            ) : row.id === "client-manager" ? null : row.active ? (
              /* The Client Manager's switch already says on/off; a badge
                 beside it would say the same thing twice. */
              <Badge className="font-normal">Bukas</Badge>
            ) : (
              <Badge variant="outline" className="font-normal">
                Sarado
              </Badge>
            )}
          </div>
          {row.tagline ? (
            <p className="truncate text-xs text-muted-foreground">
              {row.tagline}
            </p>
          ) : null}
        </div>

        {/* The tier as its own column: a tag, not a whisper in the title. */}
        {currentTier ? (
          <Badge
            variant="outline"
            className="shrink-0 rounded-full px-2.5 font-normal"
          >
            {currentTier.name}
          </Badge>
        ) : null}

        {/* The one lever that fits this module. */}
        {row.id === "client-manager" ? (
          <Switch
            checked={row.active}
            disabled={busy}
            onCheckedChange={(next) =>
              run(
                () => setClientManager(Boolean(next)),
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

      {/*
        The ladder, when the module is on and has rungs to climb. The tier
        names its price inline, because "Plus" with no number is a question,
        not an option.
      */}
      {row.active && row.tiers.length > 1 ? (
        <div className="grid gap-1.5 pl-13 sm:max-w-72">
          <Label htmlFor={`${uid}-tier`} className="sr-only">
            {row.name} subscription
          </Label>
          <Select
            items={row.tiers.map((tier) => ({
              label: tierLabel(tier),
              value: tier.id,
            }))}
            value={row.tierId ?? undefined}
            onValueChange={(next) => {
              if (typeof next === "string" && next !== row.tierId) {
                run(
                  () => setModuleTier(row.id, next),
                  "Hindi napalitan ang tier. Pakisubukan ulit."
                )
              }
            }}
          >
            <SelectTrigger id={`${uid}-tier`} className="h-11! w-full" disabled={busy}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {row.tiers.map((tier) => (
                <SelectItem key={tier.id} value={tier.id}>
                  {tierLabel(tier)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  )
}

function tierLabel(tier: { name: string; priceCentavos: number }): string {
  return tier.priceCentavos > 0
    ? `${tier.name} — ${formatPeso(tier.priceCentavos)}/buwan`
    : `${tier.name} — Libre`
}

"use client"

import * as React from "react"
import { Check, Globe, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  zoneCity,
  zoneMatches,
  zoneOffsetLabel,
  zoneRegion,
} from "@/lib/booking/timezones"
import { cn } from "@/lib/utils"

/**
 * Rendering four hundred rows costs more than it is worth when the first
 * dozen answer almost every search. The count below says what was left out,
 * so nobody concludes their city is missing.
 */
const MAX_ROWS = 60

export interface ZonePickerProps {
  value: string
  options: string[]
  /** The shop's own zone — pinned to the top and named. */
  calendarZone: string
  /** "Manila · GMT+8", built server-side. */
  calendarLabel: string
  onChange: (zone: string) => void
}

/**
 * Which zone the times are read in.
 *
 * A tag rather than a select: at rest this is one settled fact, not a control
 * demanding attention, and a native dropdown of several hundred options with no
 * way to type is close to unusable. Tapping opens a searchable list.
 */
export function ZonePicker({
  value,
  options,
  calendarZone,
  calendarLabel,
  onChange,
}: ZonePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const matches = React.useMemo(() => {
    const hits = options.filter((zone) => zoneMatches(zone, query))
    // The shop's zone first, then the one already chosen: the two anyone is
    // most likely to be reaching for.
    return hits.sort((a, b) => {
      const rank = (z: string) => (z === calendarZone ? 0 : z === value ? 1 : 2)
      return rank(a) - rank(b) || a.localeCompare(b)
    })
  }, [options, query, calendarZone, value])

  const shown = matches.slice(0, MAX_ROWS)
  const hidden = matches.length - shown.length

  function choose(zone: string) {
    onChange(zone)
    setOpen(false)
    // Cleared on close so reopening starts fresh rather than mid-search.
    setQuery("")
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-11 max-w-full items-center gap-2 rounded-full py-1.5 pr-3 pl-3 text-sm font-medium transition-colors",
          "bg-muted/60 text-foreground ring-1 ring-border hover:bg-muted",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="shrink-0 font-normal text-muted-foreground">
          Ang iyong timezone
        </span>
        <span className="min-w-0 truncate">{zoneCity(value)}</span>
        <span className="shrink-0 rounded-full bg-background/70 px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground tabular-nums">
          {zoneOffsetLabel(value)}
        </span>
        <span className="sr-only">Baguhin ang timezone</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85dvh] flex-col gap-0 p-0 sm:max-w-md">
          <DialogHeader className="space-y-1 px-4 pt-4 pb-3 sm:px-5">
            <DialogTitle className="text-base">Piliin ang timezone</DialogTitle>
            <DialogDescription className="text-xs text-pretty">
              {`Ang mga oras dito ay ipapakita sa zone na pipiliin mo. Ang shop ay nasa ${calendarLabel}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="relative px-4 pb-3 sm:px-5">
            <Search
              className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-muted-foreground sm:left-8"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Hanapin ang siyudad…"
              aria-label="Hanapin ang timezone"
              autoComplete="off"
              className="h-11 pl-9"
            />
          </div>

          {/* The list is the only thing that scrolls, so the search box and the
              title stay put while a long list moves under them. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 sm:px-3">
            {shown.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                Walang tugma sa “{query.trim()}”.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {shown.map((zone) => {
                  const active = zone === value
                  return (
                    <li key={zone}>
                      <button
                        type="button"
                        onClick={() => choose(zone)}
                        aria-pressed={active}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                          "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "bg-primary/10 text-foreground"
                            : "hover:bg-muted"
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">
                              {zoneCity(zone)}
                            </span>
                            {zone === calendarZone ? (
                              <span className="shrink-0 rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                oras ng shop
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {zoneRegion(zone)}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {zoneOffsetLabel(zone)}
                        </span>
                        {active ? (
                          <Check
                            className="size-4 shrink-0 text-primary"
                            aria-hidden
                          />
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {hidden > 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                +{hidden} pa. Mag-type para paliitin ang listahan.
              </p>
            ) : null}
          </div>

          <div className="border-t px-4 py-3 sm:px-5">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              onClick={() => setOpen(false)}
            >
              Isara
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

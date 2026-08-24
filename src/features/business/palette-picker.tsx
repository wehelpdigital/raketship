"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { setThemePreset } from "@/features/business/actions"
import {
  FAMILY_LABELS,
  PALETTES,
  type Palette,
  type PaletteFamily,
} from "@/lib/theme/palettes"
import { cn } from "@/lib/utils"

export interface PalettePickerProps {
  value: string
  disabled?: boolean
}

const FAMILY_ORDER: PaletteFamily[] = ["warm", "cool", "fresh", "neutral"]

/**
 * The colour of the whole app, picked from a grid of swatches.
 *
 * Saves on the tap rather than behind a Save button: this is the one setting
 * whose effect you can see, and making someone scroll to a button to find out
 * what their own colour looks like reads as broken.
 *
 * The swatch is painted with an inline style rather than a class. That is the
 * one place a raw colour value is allowed, because the alternative — building
 * `bg-${key}` — is a class name the Tailwind scanner cannot see, and would
 * compile to nothing at all.
 */
export function PalettePicker({ value, disabled = false }: PalettePickerProps) {
  const router = useRouter()
  const [chosen, setChosen] = React.useState(value)
  const [saving, startSaving] = React.useTransition()

  // The server is the authority; follow it if a save elsewhere changed this.
  const [seen, setSeen] = React.useState(value)
  if (seen !== value) {
    setSeen(value)
    setChosen(value)
  }

  function pick(palette: Palette) {
    if (palette.key === chosen || saving || disabled) return
    const previous = chosen
    setChosen(palette.key)

    startSaving(async () => {
      const result = await setThemePreset(palette.key)
      if (!result.ok) {
        setChosen(previous)
        toast.error(result.message ?? "Hindi na-save ang kulay.")
        return
      }
      // The palette is server-rendered into the shell, so the repaint arrives
      // with the refreshed markup — there is nothing for the client to apply.
      router.refresh()
    })
  }

  const groups = FAMILY_ORDER.map((family) => ({
    family,
    palettes: PALETTES.filter((p) => p.family === family),
  })).filter((g) => g.palettes.length > 0)

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.family} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {FAMILY_LABELS[group.family]}
          </p>
          <ul
            role="radiogroup"
            aria-label={FAMILY_LABELS[group.family]}
            className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-7"
          >
            {group.palettes.map((palette) => {
              const active = palette.key === chosen
              return (
                <li key={palette.key}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={palette.name}
                    disabled={disabled || saving}
                    onClick={() => pick(palette)}
                    className={cn(
                      "group flex w-full flex-col items-center gap-1.5 rounded-xl p-1.5 transition-colors",
                      "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                      active ? "bg-accent" : "hover:bg-muted"
                    )}
                  >
                    <span
                      // The one place a literal colour belongs: this swatch IS
                      // the value, and no token can stand in for it.
                      style={{ backgroundColor: palette.light.primary }}
                      className={cn(
                        "flex aspect-square w-full items-center justify-center rounded-lg ring-1 ring-black/10 transition-transform",
                        "group-active:scale-95 motion-reduce:group-active:scale-100",
                        active && "ring-2 ring-foreground/30"
                      )}
                    >
                      {active ? (
                        saving ? (
                          <Loader2
                            style={{ color: palette.light.primaryForeground }}
                            className="size-4 motion-safe:animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Check
                            style={{ color: palette.light.primaryForeground }}
                            className="size-4"
                            aria-hidden="true"
                          />
                        )
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "w-full truncate text-center text-[11px]",
                        active ? "font-medium text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {palette.name}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

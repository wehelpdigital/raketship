"use client"

import { useEffect, useState } from "react"

/**
 * Mirrors the `lg:` breakpoint of the Tailwind theme — the width at which the
 * shell swaps the bottom tab bar for the fixed side navigation.
 *
 * Written in `rem`, exactly as Tailwind writes it. `rem` in a media query
 * resolves against the browser default font size, so this stays pinned to the
 * `lg:` utilities even for someone who has raised that default; `1024px` would
 * quietly drift away from them.
 */
export const DESKTOP_QUERY = "(min-width: 64rem)"

export type SheetSide = "bottom" | "right"

/**
 * Bottom sheets are a phone idiom; from `lg` up the same content reads better
 * as a side panel. The `side` prop of `SheetContent` becomes a `data-side`
 * attribute that every positioning rule keys off, and an attribute value
 * cannot itself carry a media query — so this one piece of layout has to be
 * decided in JS.
 *
 * Returns `false` during SSR and on the first client render so the markup the
 * server produced is the markup React hydrates, then syncs in an effect.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    // jsdom (and any non-browser render target) may not have matchMedia.
    const media =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia(DESKTOP_QUERY)
        : null
    if (!media) return

    const sync = () => setIsDesktop(media.matches)
    sync()

    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  return isDesktop
}

/** Static lookup — Tailwind only ever sees whole class names. */
const SHEET_SIDE_CLASS: Record<SheetSide, string> = {
  // Phone: a bottom sheet that never eats the whole screen.
  bottom: "max-h-[85dvh] rounded-t-xl pb-safe",
  // Desktop: a full-height rail. `!` beats `data-[side=right]:sm:max-w-sm`,
  // whose attribute selector outranks a plain utility.
  right: "max-w-md!",
}

export function sheetSideClass(side: SheetSide): string {
  return SHEET_SIDE_CLASS[side]
}

/** `"bottom"` on phone and tablet, `"right"` from `lg` up. */
export function useSheetSide(): SheetSide {
  return useIsDesktop() ? "right" : "bottom"
}

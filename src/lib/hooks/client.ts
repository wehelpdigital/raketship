"use client"

import { useSyncExternalStore } from "react"

/** Subscriptions that never fire — the value is fixed once hydration happens. */
const NEVER = () => () => {}

/**
 * False during SSR and the first client render, true afterwards.
 *
 * The obvious version of this is `useState(false)` plus an effect that sets it
 * true, but setting state synchronously in an effect costs a second render pass
 * on every mount and React's lint rule rejects it. useSyncExternalStore is the
 * purpose-built answer: it takes a separate server snapshot, so the markup
 * matches during hydration and flips once, with no cascade.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    NEVER,
    () => true,
    () => false
  )
}

/** The browser's origin, or "" before hydration. */
export function useOrigin(): string {
  return useSyncExternalStore(
    NEVER,
    () => window.location.origin,
    () => ""
  )
}

/** The viewer's own IANA timezone, or null before hydration / when unavailable. */
export function useViewerTimezone(): string | null {
  return useSyncExternalStore(
    NEVER,
    () => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || null
      } catch {
        return null
      }
    },
    () => null
  )
}

/** Whether the Web Share sheet is available, false before hydration. */
export function useCanShare(): boolean {
  return useSyncExternalStore(
    NEVER,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false
  )
}

/**
 * A clock that ticks every `intervalMs`, as epoch milliseconds rounded down to
 * the interval — null before hydration.
 *
 * The rounding matters: getSnapshot has to return the same value between ticks
 * or React re-renders forever, so it cannot simply be Date.now().
 */
export function useNowTick(intervalMs = 30_000): number | null {
  return useSyncExternalStore(
    (onChange) => {
      const id = window.setInterval(onChange, intervalMs)
      return () => window.clearInterval(id)
    },
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => null
  )
}

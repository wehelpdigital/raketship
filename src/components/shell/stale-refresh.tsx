"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

export interface StaleRefreshProps {
  /**
   * How long the tab must have been away before coming back is worth a
   * refetch. Short flicks between windows are not.
   */
  minHiddenMs?: number
}

/**
 * Brings the shell up to date when the tab is looked at again.
 *
 * Counts like the one beside Booked live in the app layout, and a layout is
 * held in the client router cache for as long as the tab is open. A booking
 * arriving from a public link cannot invalidate that — it happens in somebody
 * else's browser entirely — so an owner who left the app open would keep
 * seeing whatever the count was when they loaded it.
 *
 * Refetching on return is the smallest thing that fixes it: no polling, no
 * socket, and nothing happening at all while the tab sits in the background.
 * `router.refresh()` re-renders the server components and leaves client state
 * alone, so a half-filled form survives it.
 */
export function StaleRefresh({ minHiddenMs = 10_000 }: StaleRefreshProps) {
  const router = useRouter()

  React.useEffect(() => {
    let hiddenAt: number | null = null

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now()
        return
      }
      // Back again. Only worth a round trip if they were actually gone.
      if (hiddenAt !== null && Date.now() - hiddenAt >= minHiddenMs) {
        router.refresh()
      }
      hiddenAt = null
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [router, minHiddenMs])

  return null
}

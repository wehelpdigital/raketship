"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

/**
 * A page-level loading overlay for navigation.
 *
 * `loading.tsx` only covers a segment once Next has started rendering the
 * destination. The gap this fills is the one before that — the moment between
 * tapping something and anything at all changing, which on a slow connection
 * reads as a dead tap.
 *
 * Rather than a router event (the App Router exposes none), it watches clicks
 * on same-origin anchors during the capture phase, so it sees the click before
 * the router does and regardless of which component rendered the link.
 */

/** Milliseconds of stillness before the overlay is worth showing at all. */
const APPEAR_AFTER = 220
/** Never leave it up forever if a navigation is cancelled or fails. */
const GIVE_UP_AFTER = 8000

interface Pending {
  /** The path we were on when the click happened. */
  from: string
  at: number
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  )
}

export function RouteTransition() {
  const pathname = usePathname() ?? ""
  const [pending, setPending] = React.useState<Pending | null>(null)
  const [ripe, setRipe] = React.useState(false)

  React.useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!isPlainLeftClick(event)) return

      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest("a")
      if (!(anchor instanceof HTMLAnchorElement)) return

      // Leave new tabs, downloads and explicit opt-outs alone.
      if (anchor.target && anchor.target !== "_self") return
      if (anchor.hasAttribute("download")) return
      if (anchor.dataset.noTransition !== undefined) return

      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#")) return

      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return

      // Same page: nothing will change, so nothing would ever hide it again.
      if (url.pathname === window.location.pathname) return

      setPending({ from: window.location.pathname, at: Date.now() })
      setRipe(false)
    }

    document.addEventListener("click", onClick, { capture: true })
    return () => document.removeEventListener("click", onClick, { capture: true })
  }, [])

  // Whether a navigation is still outstanding is derived, not stored: the
  // pathname changing IS the completion signal, so there is nothing to clear.
  const navigating = pending !== null && pending.from === pathname

  React.useEffect(() => {
    if (!navigating) return
    // Instant navigations are the common case; flashing a spinner at them
    // looks worse than showing nothing.
    const appear = window.setTimeout(() => setRipe(true), APPEAR_AFTER)
    const giveUp = window.setTimeout(() => setPending(null), GIVE_UP_AFTER)
    return () => {
      window.clearTimeout(appear)
      window.clearTimeout(giveUp)
    }
  }, [navigating])

  const visible = navigating && ripe

  return (
    <>
      {/* The bar shows as soon as the click lands — it is cheap enough to be
          worth showing even for a navigation that turns out to be instant. */}
      <div
        aria-hidden="true"
        className={cx(
          "pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-primary transition-transform duration-300 ease-out",
          navigating ? "scale-x-100" : "scale-x-0"
        )}
        style={{
          transitionDuration: navigating ? "2.4s" : "180ms",
          transitionTimingFunction: navigating
            ? "cubic-bezier(0.1, 0.8, 0.2, 1)"
            : undefined,
        }}
      />

      <div
        role="status"
        aria-live="polite"
        aria-busy={visible}
        className={cx(
          "pointer-events-none fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200",
          visible
            ? "bg-background/55 opacity-100 backdrop-blur-[2px]"
            : "opacity-0"
        )}
      >
        {visible ? (
          <span className="flex items-center gap-3 rounded-full bg-card px-4 py-2.5 shadow-lg ring-1 ring-border">
            <span className="relative inline-flex size-4">
              <span className="absolute inset-0 rounded-full border-2 border-primary/25 border-t-primary motion-safe:animate-spin" />
            </span>
            <span className="text-sm font-medium">Loading…</span>
          </span>
        ) : null}
        <span className="sr-only">{visible ? "Loading page" : ""}</span>
      </div>
    </>
  )
}

/** Local join so this file has no import beyond React and the router. */
function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ")
}

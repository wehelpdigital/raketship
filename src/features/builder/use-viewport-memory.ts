"use client"

import { useCallback, useEffect, useRef } from "react"
import { useReactFlow, type Viewport } from "@xyflow/react"

/**
 * Remembers where you were looking on a canvas.
 *
 * Node positions are real data and live in the database. Where the camera sits
 * is a per-device view preference — it should not follow you to another screen,
 * and panning fires often enough that persisting it server-side would be a lot
 * of writes for no benefit. So it lives in localStorage.
 *
 * Without this, `fitView` re-frames on every mount and a canvas you carefully
 * arranged comes back at a different zoom, which reads as "it did not save".
 */

const PREFIX = "raketship:viewport:"

function keyFor(flowId: string) {
  return `${PREFIX}${flowId}`
}

function read(flowId: string): Viewport | null {
  // Private windows, cleared site data, and thumbnailing contexts all make
  // this throw rather than return null.
  try {
    const raw = window.localStorage.getItem(keyFor(flowId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "x" in parsed &&
      "y" in parsed &&
      "zoom" in parsed
    ) {
      const { x, y, zoom } = parsed as Viewport
      if (
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(zoom) &&
        zoom > 0
      ) {
        return { x, y, zoom }
      }
    }
    return null
  } catch {
    return null
  }
}

function write(flowId: string, viewport: Viewport): void {
  try {
    window.localStorage.setItem(
      keyFor(flowId),
      JSON.stringify({
        x: Math.round(viewport.x),
        y: Math.round(viewport.y),
        zoom: Number(viewport.zoom.toFixed(3)),
      })
    )
  } catch {
    // Storage full or blocked — the canvas still works, it just forgets.
  }
}

export function useViewportMemory(flowId: string) {
  const { setViewport } = useReactFlow()
  const restored = useRef(false)

  // Restored in an effect rather than through `defaultViewport` so the server
  // and the first client render agree; localStorage does not exist during SSR.
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const saved = read(flowId)
    if (saved) void setViewport(saved, { duration: 0 })
  }, [flowId, setViewport])

  const remember = useCallback(
    (viewport: Viewport) => {
      // Ignore the frames React Flow emits while fitView is settling, before
      // the user has actually moved anything.
      if (!restored.current) return
      write(flowId, viewport)
    },
    [flowId]
  )

  return { remember }
}

"use client"

import { useLinkStatus } from "next/link"

import { cn } from "@/lib/utils"

/**
 * Inline pending feedback for a nav link. Must be rendered *inside* a `<Link>`
 * — useLinkStatus reads the pending state of its nearest Link ancestor.
 *
 * The route-level loading.tsx files cover the destination; this covers the gap
 * before it, which is the part that otherwise feels like a dead tap.
 */
export function NavPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus()

  if (!pending) return null

  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-3.5 shrink-0 rounded-full border-2 border-current/25 border-t-current opacity-70 motion-safe:animate-spin",
        className
      )}
    />
  )
}

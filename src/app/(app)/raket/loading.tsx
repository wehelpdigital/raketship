import { RouteLoader } from "@/components/shell/loader"

/**
 * The board is full-bleed, so its loading state matches that box rather than
 * sitting inside a page container — otherwise the canvas visibly jumps in.
 */
export default function Loading() {
  return (
    <div className="flex h-[calc(100dvh-10.75rem)] min-h-96 flex-col md:h-[calc(100dvh-7.25rem)] lg:h-[calc(100dvh-7.75rem)]">
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3 sm:px-6 lg:px-8">
        <div className="h-5 w-40 rounded bg-muted motion-safe:animate-pulse" />
      </div>
      <div className="min-h-0 flex-1 bg-muted/30">
        <RouteLoader label="Opening your canvas" />
      </div>
    </div>
  )
}

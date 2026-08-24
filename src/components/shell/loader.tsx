import { cn } from "@/lib/utils"

/**
 * The rocket mark, drawn as a pulsing ring.
 *
 * Motion is CSS-only so it starts painting immediately — a loader that waits
 * for JavaScript to hydrate has already missed the moment it exists for.
 */
export function Spinner({
  className,
  label = "Loading",
}: {
  className?: string
  label?: string
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("relative inline-flex size-6", className)}
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-primary/25" />
      <span className="absolute inset-0 rounded-full border-2 border-primary/25 border-t-primary motion-safe:animate-spin" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

/** A full-panel loading state for a route segment. */
export function RouteLoader({
  label = "Loading",
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-64 flex-1 flex-col items-center justify-center gap-3 py-16",
        className
      )}
    >
      <Spinner className="size-7" label={label} />
      <p className="text-sm text-muted-foreground">{label}…</p>
    </div>
  )
}

/**
 * Skeleton blocks that mirror a card list, so the page does not jump when the
 * real content replaces them.
 */
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-border sm:p-5"
        >
          <div className="size-10 shrink-0 rounded-lg bg-muted motion-safe:animate-pulse" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-1/3 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-muted/70 motion-safe:animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

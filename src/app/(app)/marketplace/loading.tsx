import { PageContainer } from "@/components/shell/page-container"
import { Spinner } from "@/components/shell/loader"

export default function Loading() {
  return (
    <PageContainer>
      <div className="flex items-center gap-3">
        <Spinner />
        <div className="h-6 w-44 rounded bg-muted motion-safe:animate-pulse" />
      </div>

      {/* Mirrors the module grid so the layout does not jump on arrival. */}
      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        aria-hidden="true"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-border sm:p-5"
          >
            <div className="size-11 rounded-xl bg-muted motion-safe:animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-3 w-full rounded bg-muted/70 motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    </PageContainer>
  )
}

import { PageContainer } from "@/components/shell/page-container"
import { CardSkeleton, Spinner } from "@/components/shell/loader"

/** Fallback for any authenticated segment without its own loading state. */
export default function Loading() {
  return (
    <PageContainer>
      <div className="flex items-center gap-3">
        <Spinner />
        <div className="h-5 w-40 rounded bg-muted motion-safe:animate-pulse" />
      </div>
      <CardSkeleton rows={3} />
    </PageContainer>
  )
}

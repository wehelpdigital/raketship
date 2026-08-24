import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ChevronLeft, Sparkles } from "lucide-react"

import { PageContainer } from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { supabaseConfigured } from "@/lib/env"
import { cn } from "@/lib/utils"
import {
  rowToCanvasEdge,
  rowToCanvasNode,
  unlockedNodeTypes,
} from "@/lib/flow/mappers"
import {
  getModuleCanvas,
  getModuleNode,
  getWorkspace,
} from "@/lib/queries/workspace"
import { getCurrentUser } from "@/lib/supabase/server"
import type { FlowNodeRow } from "@/lib/supabase/types"

import { Canvas } from "@/features/builder/canvas"
import { RunPreview } from "@/features/builder/run-preview"

interface PageProps {
  params: Promise<{ nodeId: string }>
}

function nodeLabel(node: FlowNodeRow | null): string {
  const label = node?.data?.label
  return typeof label === "string" && label.trim().length > 0
    ? label.trim()
    : "Module"
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { nodeId } = await params
  const user = await getCurrentUser()
  if (!user) return { title: "Module builder" }

  const node = await getModuleNode(nodeId)
  if (!node || node.user_id !== user.id) return { title: "Module builder" }

  return {
    title: `${nodeLabel(node)} builder`,
    description: `Wire up the steps inside your ${nodeLabel(node)} module.`,
  }
}

function BackLink() {
  return (
    <Link
      href="/raket"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to your raket
    </Link>
  )
}

/**
 * Identity, tier and actions for the module. It reads as a header above the
 * canvas on phone and tablet, and becomes the right-hand context panel from
 * `lg` up — same markup, moved by `order`, so nothing renders twice.
 */
function ModuleContext({
  moduleName,
  tierName,
  unlockedCount,
  moduleId,
  preview,
}: {
  moduleName: string
  tierName: string
  unlockedCount: number
  moduleId?: string
  preview?: React.ReactNode
}) {
  return (
    // `gap`, not `space-y`: the two desktop-only blocks below are display:none
    // on a phone, and `space-y` would still hang its margin off the last
    // visible child and open a phantom gap above the canvas.
    <header className="flex flex-col gap-3 lg:order-2 lg:gap-4 lg:rounded-xl lg:bg-card lg:p-5 lg:shadow-sm lg:ring-1 lg:ring-border">
      <div className="flex items-start justify-between gap-3 lg:flex-col lg:items-stretch lg:gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-xl font-semibold text-balance lg:text-2xl">
            {moduleName}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-normal">
              {tierName}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {unlockedCount} step
              {unlockedCount === 1 ? "" : "s"} unlocked
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          className="h-11 shrink-0 lg:w-full"
          render={
            <Link href={moduleId ? `/marketplace/${moduleId}` : "/marketplace"} />
          }
        >
          <Sparkles />
          Upgrade
        </Button>
      </div>

      {/* Below lg the canvas keeps its own floating preview button, so this
          one only appears at the width where that button hides. */}
      {preview ? <div className="hidden lg:block">{preview}</div> : null}

      <div className="hidden lg:block lg:border-t lg:border-border lg:pt-4">
        <h3 className="text-sm font-semibold">What goes in here?</h3>
        <p className="mt-1 max-w-prose text-sm text-pretty text-muted-foreground">
          The steps this module runs, in order. Drop a step on the canvas, draw
          a line from the one before it, and tap a card to fill in its details.
        </p>
      </div>
    </header>
  )
}

/** Back link, then the canvas beside its context panel. */
function BuilderLayout({
  context,
  children,
}: {
  context: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3 lg:space-y-6">
      <BackLink />
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:items-start lg:gap-8">
        {context}
        <div className="lg:order-1 lg:col-span-2">{children}</div>
      </div>
    </div>
  )
}

export default async function ModuleCanvasPage({ params }: PageProps) {
  const { nodeId } = await params
  const user = await getCurrentUser()

  if (!user) {
    return (
      <PageContainer>
        <BackLink />
        <div className="rounded-xl bg-card p-4 text-center shadow-sm ring-1 ring-border sm:p-5 lg:mx-auto lg:max-w-xl lg:p-8">
          <h2 className="text-lg font-semibold text-balance lg:text-2xl">
            Sign in to open this builder
          </h2>
          <p className="mx-auto mt-1 max-w-prose text-sm text-pretty text-muted-foreground lg:text-base">
            Your modules and the steps inside them live with your account.
          </p>
          {supabaseConfigured ? (
            <Button
              className="mt-6 h-11 w-full lg:mx-auto lg:max-w-xs"
              render={<Link href="/login" />}
            >
              Sign in
            </Button>
          ) : null}
        </div>

        {supabaseConfigured ? null : <SetupNotice />}
      </PageContainer>
    )
  }

  const node = await getModuleNode(nodeId)
  if (!node || node.user_id !== user.id) notFound()

  const [workspace, canvas] = await Promise.all([
    getWorkspace(user.id),
    getModuleCanvas(nodeId),
  ])

  const activated = workspace.modules.find(
    (item) => item.module_id === node.module_id
  )
  const tier = activated?.tier ?? null
  const moduleId = node.module_id ?? activated?.module_id ?? undefined
  const moduleName = activated?.module?.name ?? nodeLabel(node)
  const unlockedTypes = unlockedNodeTypes(tier)
  const tierName = tier?.name ?? "Not activated"

  if (!canvas.flow) {
    return (
      <PageContainer>
        <BuilderLayout
          context={
            <ModuleContext
              moduleName={moduleName}
              tierName={tierName}
              unlockedCount={unlockedTypes.length}
              moduleId={moduleId}
            />
          }
        >
          <div className="rounded-xl bg-card p-4 text-center shadow-sm ring-1 ring-border sm:p-5 lg:p-8">
            <h2 className="text-base font-medium text-balance lg:text-lg">
              This builder is not set up yet
            </h2>
            <p className="mx-auto mt-1 max-w-prose text-sm text-pretty text-muted-foreground">
              Head back to your raket and run the setup — we will create this
              module&apos;s canvas with its first steps already wired.
            </p>
            <Button
              variant="outline"
              className="mt-6 h-11 w-full lg:mx-auto lg:max-w-xs"
              render={<Link href="/raket" />}
            >
              Back to your raket
            </Button>
          </div>
        </BuilderLayout>
      </PageContainer>
    )
  }

  const nodes = canvas.nodes.map((row) =>
    rowToCanvasNode(row, { unlockedTypes })
  )
  const edges = canvas.edges.map(rowToCanvasEdge)

  return (
    // Same full-bleed workspace as the outer board: the canvas is the page, and
    // the context that used to fill a right rail rides in the bar above it.
    <div className="flex h-[calc(100dvh-10.75rem)] min-h-96 flex-col md:h-[calc(100dvh-7.25rem)] lg:h-[calc(100dvh-7.75rem)]">
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/raket"
          aria-label="Back to your raket"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronLeft className="size-4.5" aria-hidden="true" />
        </Link>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-balance lg:text-lg">
            {moduleName}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {tierName} · {unlockedTypes.length} step
            {unlockedTypes.length === 1 ? "" : "s"} unlocked
          </p>
        </div>

        <RunPreview variant="icon" nodes={nodes} edges={edges} />
        <Link
          href={`/marketplace/${moduleId}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "hidden h-9 sm:inline-flex"
          )}
        >
          Upgrade
        </Link>
      </div>

      <div className="min-h-0 flex-1">
        <Canvas
          flowId={canvas.flow.id}
          scope="module"
          moduleId={moduleId}
          initialNodes={nodes}
          initialEdges={edges}
          unlockedTypes={unlockedTypes}
        />
      </div>
    </div>
  )
}

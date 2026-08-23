import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Sparkles } from "lucide-react"

import { PageContainer } from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { supabaseConfigured } from "@/lib/env"
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

export default async function ModuleCanvasPage({ params }: PageProps) {
  const { nodeId } = await params
  const user = await getCurrentUser()

  if (!user) {
    return (
      <PageContainer>
        <BackLink />
        <div className="rounded-xl bg-card p-4 text-center shadow-sm ring-1 ring-border sm:p-5">
          <h1 className="text-lg font-semibold text-balance">
            Sign in to open this builder
          </h1>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            Your modules and the steps inside them live with your account.
          </p>
          {supabaseConfigured ? (
            <Button className="mt-6 h-11 w-full" render={<Link href="/login" />}>
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

  const header = (
    <header className="space-y-3">
      <BackLink />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-xl font-semibold text-balance">
            {moduleName}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-normal">
              {tier?.name ?? "Not activated"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {unlockedTypes.length} step
              {unlockedTypes.length === 1 ? "" : "s"} unlocked
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          className="h-11 shrink-0"
          render={
            <Link href={moduleId ? `/marketplace/${moduleId}` : "/marketplace"} />
          }
        >
          <Sparkles />
          Upgrade
        </Button>
      </div>
    </header>
  )

  if (!canvas.flow) {
    return (
      <PageContainer>
        {header}
        <div className="rounded-xl bg-card p-4 text-center shadow-sm ring-1 ring-border sm:p-5">
          <h2 className="text-base font-medium text-balance">
            This builder is not set up yet
          </h2>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            Head back to your raket and run the setup — we will create this
            module&apos;s canvas with its first steps already wired.
          </p>
          <Button
            variant="outline"
            className="mt-6 h-11 w-full"
            render={<Link href="/raket" />}
          >
            Back to your raket
          </Button>
        </div>
      </PageContainer>
    )
  }

  const nodes = canvas.nodes.map((row) =>
    rowToCanvasNode(row, { unlockedTypes })
  )
  const edges = canvas.edges.map(rowToCanvasEdge)

  return (
    <PageContainer>
      {header}

      <Canvas
        flowId={canvas.flow.id}
        scope="module"
        moduleId={moduleId}
        initialNodes={nodes}
        initialEdges={edges}
        unlockedTypes={unlockedTypes}
      />
    </PageContainer>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { Boxes, Rocket } from "lucide-react"

import { PageContainer } from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import { Button } from "@/components/ui/button"
import { rowToCanvasEdge, rowToCanvasNode } from "@/lib/flow/mappers"
import { getRaketCanvas, getWorkspace } from "@/lib/queries/workspace"
import { getCurrentUser } from "@/lib/supabase/server"

import { ensureWorkspace } from "@/features/builder/actions"
import { RaketCanvas } from "@/features/builder/canvas"
import { RenameRaketDialog } from "@/features/builder/rename-raket-dialog"
import { RunPreview } from "@/features/builder/run-preview"

export const metadata: Metadata = {
  title: "Build your Raket",
  description:
    "Drag, drop and connect the modules that run your business — one canvas for the whole raket.",
}

async function setUpWorkspace() {
  "use server"
  await ensureWorkspace()
}

/**
 * Shown whenever there is nothing to draw yet — no session, no Supabase keys,
 * or an account the provisioning trigger never got to.
 */
function SetupPanel({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action: React.ReactNode
}) {
  return (
    <PageContainer>
      <div className="rounded-xl bg-card p-4 text-center shadow-sm ring-1 ring-border sm:p-5">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Rocket className="size-6" />
        </span>
        <h1 className="mt-3 text-lg font-semibold text-balance">{title}</h1>
        <p className="mt-1 text-sm text-pretty text-muted-foreground">{body}</p>
        <div className="mt-6">{action}</div>
      </div>

      <SetupNotice />
    </PageContainer>
  )
}

export default async function RaketPage() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <SetupPanel
        title="Build your Raket"
        body="Sign in and we will open your canvas — your modules, wired together the way your business actually runs."
        action={
          <Button className="h-11 w-full" render={<Link href="/login" />}>
            Sign in
          </Button>
        }
      />
    )
  }

  const workspace = await getWorkspace(user.id)
  const canvas = workspace.raket
    ? await getRaketCanvas(workspace.raket.id)
    : { flow: null, nodes: [], edges: [] }

  if (!workspace.raket || !canvas.flow) {
    return (
      <SetupPanel
        title="Let us set up your raket"
        body="You do not have a canvas yet. We will create one with your free Booking module already on it."
        action={
          <form action={setUpWorkspace}>
            <Button type="submit" className="h-11 w-full">
              Set up my raket
            </Button>
          </form>
        }
      />
    )
  }

  const nodes = canvas.nodes.map((row) => rowToCanvasNode(row))
  const edges = canvas.edges.map(rowToCanvasEdge)
  const nodeIds = Object.fromEntries(
    canvas.nodes.map((row) => [row.node_key, row.id])
  )
  const moduleCount = canvas.nodes.filter((row) => row.type === "module").length

  return (
    <PageContainer>
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Build your Raket
            </p>
            <h1 className="truncate text-xl font-semibold text-balance">
              {workspace.raket.name}
            </h1>
          </div>
          <RenameRaketDialog
            raketId={workspace.raket.id}
            name={workspace.raket.name}
          />
        </div>

        <p className="text-sm text-pretty text-muted-foreground">
          {moduleCount === 0
            ? "No modules on the canvas yet."
            : `${moduleCount} module${moduleCount === 1 ? "" : "s"} on the canvas.`}{" "}
          Tap a module to open its own builder.
        </p>

        <div className="flex items-center gap-3">
          <RunPreview nodes={nodes} edges={edges} />
          <Button
            variant="outline"
            className="h-11"
            render={<Link href="/marketplace" />}
          >
            <Boxes />
            Add a module
          </Button>
        </div>
      </header>

      <RaketCanvas
        flowId={canvas.flow.id}
        initialNodes={nodes}
        initialEdges={edges}
        nodeIds={nodeIds}
      />
    </PageContainer>
  )
}

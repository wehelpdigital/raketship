import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowUpRight, PencilRuler, Workflow } from "lucide-react"

import { ModuleIcon } from "@/components/module-icon"
import { PageContainer, PageHeader } from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import { accentChip } from "@/components/shell/module-nav"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { summarise } from "@/lib/flow/registry"
import { linearise, rowToCanvasEdge, rowToCanvasNode } from "@/lib/flow/mappers"
import { supabaseConfigured } from "@/lib/env"
import { getModule } from "@/lib/queries/catalog"
import {
  getModuleCanvas,
  getModuleNodeForUser,
  getWorkspace,
} from "@/lib/queries/workspace"
import { getCurrentUser } from "@/lib/supabase/server"
import { cn, formatPeso } from "@/lib/utils"

interface PageProps {
  params: Promise<{ moduleId: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { moduleId } = await params
  const mod = await getModule(moduleId)
  return { title: mod?.name ?? "Module" }
}

export default async function ModuleHomePage({ params }: PageProps) {
  const { moduleId } = await params
  const user = await getCurrentUser()

  if (!supabaseConfigured || !user) {
    return (
      <PageContainer>
        <SetupNotice />
      </PageContainer>
    )
  }

  const [mod, workspace] = await Promise.all([
    getModule(moduleId),
    getWorkspace(user.id),
  ])

  const owned = workspace.modules.find(
    (m) => m.module_id === moduleId && m.status === "active"
  )

  // A module the user has not activated is not their module — send them to the
  // marketplace listing rather than showing an empty shell.
  if (!mod) notFound()
  if (!owned) {
    return (
      <PageContainer>
        <PageHeader
          title={mod.name}
          description="You have not added this module to your raket yet."
        />
        <Card>
          <CardContent className="space-y-3">
            <p className="max-w-prose text-sm text-pretty text-muted-foreground">
              {mod.description ?? mod.tagline}
            </p>
            <Link
              href={`/marketplace/${mod.id}`}
              className={cn(buttonVariants(), "h-11 w-full sm:w-auto")}
            >
              See it in the marketplace
            </Link>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  const node = await getModuleNodeForUser(user.id, moduleId)
  const canvas = node
    ? await getModuleCanvas(node.id)
    : { flow: null, nodes: [], edges: [] }

  const steps = linearise(
    canvas.nodes.map((n) => rowToCanvasNode(n)),
    canvas.edges.map(rowToCanvasEdge)
  )

  const tiers = mod.tiers ?? []
  const currentLevel = owned.tier?.level ?? 0
  const nextTier = tiers.find((t) => t.level > currentLevel) ?? null

  return (
    <PageContainer>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl lg:size-12",
                accentChip(mod.accent)
              )}
            >
              <ModuleIcon
                name={mod.icon}
                className="size-5 lg:size-6"
                aria-hidden="true"
              />
            </span>
            {mod.name}
          </span>
        }
        description={mod.tagline}
        action={
          owned.tier ? <Badge variant="secondary">{owned.tier.name}</Badge> : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="size-4 text-muted-foreground" aria-hidden="true" />
                How this module runs
              </CardTitle>
              <CardDescription>
                {steps.length > 0
                  ? "The steps below run in order whenever this module is triggered."
                  : "Nothing is wired up yet."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {steps.length > 0 ? (
                <ol className="space-y-3">
                  {steps.map((step, i) => (
                    <li
                      key={step.id}
                      className="flex items-start gap-3 rounded-xl bg-muted/40 p-4"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold tabular-nums">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {String(step.data.values.label ?? step.data.nodeType)}
                        </span>
                        <span className="mt-0.5 block text-xs text-pretty text-muted-foreground">
                          {summarise(step.data.nodeType, step.data.values)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="max-w-prose text-sm text-pretty text-muted-foreground">
                  Open the builder to add your first step.
                </p>
              )}

              {node ? (
                <Link
                  href={`/raket/${node.id}`}
                  className={cn(
                    buttonVariants(),
                    "h-11 w-full gap-2 sm:w-auto"
                  )}
                >
                  <PencilRuler aria-hidden="true" />
                  Open the builder
                </Link>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your plan for this module</CardTitle>
              <CardDescription>
                {owned.tier?.description ?? "Choose how much you need."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {nextTier ? (
                <>
                  <p className="text-sm text-pretty text-muted-foreground">
                    {`${nextTier.name} adds more for ${
                      nextTier.price_centavos > 0
                        ? `${formatPeso(nextTier.price_centavos)}/mo`
                        : "free"
                    }.`}
                  </p>
                  <Link
                    href={`/marketplace/${mod.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "h-11 w-full gap-2"
                    )}
                  >
                    Upgrade to {nextTier.name}
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                </>
              ) : (
                <p className="text-sm text-pretty text-muted-foreground">
                  You are on the top tier for this module.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}

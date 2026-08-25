import type { Metadata } from "next"
import Link from "next/link"
import { Rocket } from "lucide-react"

import { PageContainer } from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import { Button, buttonVariants } from "@/components/ui/button"
import { supabaseConfigured } from "@/lib/env"
import { cn } from "@/lib/utils"
import {
  bookingGlance,
  businessGlance,
  type ModuleGlance,
} from "@/lib/flow/glance"
import { rowToCanvasEdge, rowToCanvasNode } from "@/lib/flow/mappers"
import { getLocale, getT } from "@/lib/i18n/server"
import {
  countCalendars,
  countUpcomingBookings,
} from "@/lib/queries/booking"
import { getBusinessProfile } from "@/lib/queries/business"
import {
  getRaketCanvas,
  getWorkspace,
  type CanvasPayload,
} from "@/lib/queries/workspace"
import { getCurrentUser } from "@/lib/supabase/server"

import { ensureWorkspace } from "@/features/builder/actions"
import { RaketCanvas } from "@/features/builder/canvas"
import { RenameRaketDialog } from "@/features/builder/rename-raket-dialog"

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
 * or an account the provisioning trigger never got to. It stays a single
 * centred column at every width: a lone message has nothing to put beside it.
 */
function SetupPanel({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <PageContainer>
      <div className="rounded-xl bg-card p-4 text-center shadow-sm ring-1 ring-border sm:p-5 lg:mx-auto lg:max-w-xl lg:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary lg:size-16">
          <Rocket className="size-6 lg:size-8" />
        </span>
        <h2 className="mt-3 text-lg font-semibold text-balance lg:mt-4 lg:text-2xl">
          {title}
        </h2>
        <p className="mx-auto mt-1 max-w-prose text-sm text-pretty text-muted-foreground lg:text-base">
          {body}
        </p>
        {action ? <div className="mt-6 lg:mx-auto lg:max-w-xs">{action}</div> : null}
      </div>

      <SetupNotice />
    </PageContainer>
  )
}

export default async function RaketPage() {
  const user = await getCurrentUser()

  if (!user) {
    // Without keys there is no session to have, so pointing at /login would
    // only send people in a circle. The steps below are the real next action.
    return supabaseConfigured ? (
      <SetupPanel
        title="Build your Raket"
        body="Sign in and we will open your canvas — your modules, wired together the way your business actually runs."
        action={
          <Link
            href="/login"
            className={cn(buttonVariants(), "h-11 w-full")}
          >
            Sign in
          </Link>
        }
      />
    ) : (
      <SetupPanel
        title="Build your Raket"
        body="This is where your modules sit on one canvas, wired together the way your business actually runs. Connect a database and it opens."
      />
    )
  }

  const workspace = await getWorkspace(user.id)
  const canvas: CanvasPayload = workspace.raket
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

  /*
    The module cards carry their own live numbers, so the canvas is a picture
    of what IS running rather than a diagram of what could. Assembled here,
    where the queries are cached per-request; the client just paints strings.
  */
  const locale = await getLocale()
  const t = await getT()
  const profile = await getBusinessProfile(user.id)
  const glances: Record<string, ModuleGlance> = {}
  for (const row of canvas.nodes) {
    /*
      The START node is the business — "where every raket begins", with the
      business name as its one field — so it wears the shop: logo, name,
      theme. The Your Business module has no separate card on the canvas.
    */
    if (row.type === "start") {
      glances[row.node_key] = businessGlance(profile, locale)
      continue
    }
    if (row.type !== "module") continue
    if (row.module_id === "booking") {
      const [calendars, upcoming] = await Promise.all([
        countCalendars(user.id),
        countUpcomingBookings(user.id),
      ])
      glances[row.node_key] = bookingGlance(
        {
          calendars: calendars.total,
          published: calendars.published,
          upcoming,
        },
        locale
      )
    } else if (row.module_id === "business") {
      glances[row.node_key] = businessGlance(profile, locale)
    }
  }

  const shopName = profile?.business_name?.trim()
  const nodes = canvas.nodes.map((row, index) => {
    const node = rowToCanvasNode(row)
    /*
      The start card is the shop, so it wears the shop's NAME as its title —
      but only while the node still has its stock label. An owner who renamed
      the node on the canvas said something on purpose, and it stays said.
      Display only; nothing is written back.
    */
    const values =
      row.type === "start" &&
      shopName &&
      node.data.values.label === "Your business"
        ? { ...node.data.values, label: shopName }
        : node.data.values
    return {
      ...node,
      data: {
        ...node.data,
        values,
        glance: glances[row.node_key],
        enterIndex: index,
      },
    }
  })
  const edges = canvas.edges.map(rowToCanvasEdge)
  const nodeIds: Record<string, string> = Object.fromEntries(
    canvas.nodes.map((row): [string, string] => [row.node_key, row.id])
  )
  const moduleCount = canvas.nodes.filter((row) => row.type === "module").length

  return (
    /*
     * Full-bleed workspace: the board is the page. Everything the old right
     * rail carried either moved into the slim bar below or lives elsewhere —
     * modules are bought in the Raket Market, so there is nothing to add here.
     *
     * The height budget is only the chrome that actually surrounds it: the app
     * bar (3.5rem, 4rem at lg), this bar (~3.75rem) and, on a phone, the tab bar.
     */
    <div className="flex h-[calc(100dvh-10.75rem)] min-h-96 flex-col md:h-[calc(100dvh-7.25rem)] lg:h-[calc(100dvh-7.75rem)]">
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-balance lg:text-lg">
            {workspace.raket.name}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {moduleCount === 0
              ? t("raket.summary.none")
              : t(
                  moduleCount === 1 ? "raket.summary.one" : "raket.summary.many",
                  { n: moduleCount }
                )}
          </p>
        </div>
        <RenameRaketDialog
          raketId={workspace.raket.id}
          name={workspace.raket.name}
        />
      </div>

      <div className="min-h-0 flex-1">
        <RaketCanvas
          flowId={canvas.flow.id}
          initialNodes={nodes}
          initialEdges={edges}
          nodeIds={nodeIds}
        />
      </div>
    </div>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { Blocks, Rocket } from "lucide-react"

import { PageContainer } from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import { Button, buttonVariants } from "@/components/ui/button"
import { supabaseConfigured } from "@/lib/env"
import { cn } from "@/lib/utils"
import { assignModuleAccents, oklchHue } from "@/lib/flow/accents"
import {
  bookingGlance,
  businessGlance,
  type ModuleGlance,
} from "@/lib/flow/glance"
import {
  rowToCanvasEdge,
  rowToCanvasNode,
  type CanvasNode,
} from "@/lib/flow/mappers"
import { getLocale, getT } from "@/lib/i18n/server"
import { countUpcomingBookings } from "@/lib/queries/booking"
import { getBusinessProfile } from "@/lib/queries/business"
import { getPalette } from "@/lib/theme/palettes"
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
      glances[row.node_key] = bookingGlance(
        await countUpcomingBookings(user.id)
      )
    } else if (row.module_id === "business") {
      glances[row.node_key] = businessGlance(profile, locale)
    }
  }

  /*
    Each module's own icon and accent, read off its catalog row so the node
    wears the same dress as the nav and the marketplace. Keyed by module id;
    a module with no row falls back to the registry's generic look.
  */
  /*
    Every element wears its own colour, assigned per account: the primary
    MOVES with the chosen palette, so a fixed catalog accent can twin the
    start card on one shop and be fine on another (lila sits five degrees
    from chart-4). See lib/flow/accents.ts for the rules.
  */
  const primaryHue =
    oklchHue(getPalette(profile?.theme_preset).light.primary) ?? 27
  const catalog = workspace.modules.flatMap((activated) =>
    // The business module has no node of its own — the start card wears the
    // primary for it — so it must not consume one of the four accents.
    activated.module && activated.module.id !== "business"
      ? [{ id: activated.module.id, accent: activated.module.accent }]
      : []
  )
  const accents = assignModuleAccents(catalog, primaryHue)
  const dress: Record<
    string,
    { accent?: string; icon?: string; tagline?: string }
  > = {}
  for (const activated of workspace.modules) {
    if (!activated.module) continue
    dress[activated.module.id] = {
      accent: accents[activated.module.id],
      icon: activated.module.icon,
      tagline: activated.module.tagline ?? undefined,
    }
  }

  const shopName = profile?.business_name?.trim()
  const nodes: CanvasNode[] = canvas.nodes.map((row, index) => {
    const node = rowToCanvasNode(row)
    /*
      The start card leads with the shop's NAME; "Your business" drops to the
      tag beneath it. Only while the node still wears its stock label — an
      owner who renamed it on the canvas said something on purpose. Display
      only; nothing is written back.
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
        ...(row.module_id ? (dress[row.module_id] ?? {}) : {}),
      },
    }
  })
  const edges = canvas.edges.map(rowToCanvasEdge)

  /*
    The Clients marker: presentation, not data. Injected here rather than
    stored, so no account has to be provisioned with it, nobody can drag it
    half off the board, and removing it someday is deleting this block. It
    sits centred BELOW the public-facing modules with its arrows flowing UP
    into them — customers entering — and only exists while there is at least
    one door for them to enter.
  */
  const doors = nodes.filter(
    (node) => node.id === "module-booking" || node.id === "module-website"
  )
  if (doors.length > 0) {
    const cx =
      doors.reduce((sum, door) => sum + door.position.x, 0) / doors.length
    const cy = Math.max(...doors.map((door) => door.position.y))
    nodes.push({
      id: "clients",
      type: "element",
      // Cards are ~300 wide, the marker ~176: +70 keeps centres aligned.
      position: { x: cx + 70, y: cy + 280 },
      data: {
        nodeType: "clients",
        moduleId: null,
        locked: false,
        values: {},
        enterIndex: nodes.length,
      },
      draggable: false,
      selectable: false,
      connectable: false,
    })
    for (const door of doors) {
      edges.push({
        id: `clients->${door.id}`,
        source: "clients",
        target: door.id,
        animated: true,
      })
    }
  }
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
      {/* The hairline starts in the shop's colour and dissolves into the
          ordinary border — one pixel tying the chrome to the board below. */}
      <div className="relative flex shrink-0 items-center gap-3 px-4 py-3 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-linear-to-r after:from-primary/50 after:via-border after:to-border sm:px-6 lg:px-8">
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
        {/* The way in for phones and tablets, whose nav has no sub-rows. */}
        <Link
          href="/raket/parts"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Blocks className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">My raket parts</span>
          <span className="sr-only sm:hidden">My raket parts</span>
        </Link>
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

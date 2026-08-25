"use client"

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import {
  Boxes,
  CalendarCheck,
  CalendarPlus,
  ChevronRight,
  CreditCard,
  GitBranch,
  Globe,
  Lock,
  Users,
  Mail,
  MessageSquare,
  Package,
  Rocket,
  Timer,
  UserCheck,
  Webhook,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { LogoMask } from "@/features/business/logo-mask"
import type { ModuleGlance } from "@/lib/flow/glance"
import type { CanvasNodeData } from "@/lib/flow/mappers"
import { CATEGORY_LABELS, resolveNodeType, summarise } from "@/lib/flow/registry"
import { cn } from "@/lib/utils"

export type BuilderNode = Node<CanvasNodeData>

const ICONS: Record<string, LucideIcon> = {
  Package,
  Boxes,
  CalendarCheck,
  CalendarPlus,
  CreditCard,
  GitBranch,
  Globe,
  Mail,
  Users,
  MessageSquare,
  Rocket,
  Timer,
  UserCheck,
  Webhook,
}

export function NodeIcon({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const Icon = ICONS[name] ?? Boxes
  return <Icon className={className} aria-hidden="true" />
}

// Static map: Tailwind can only see class names it can read in the source, so
// accent classes are never built by interpolation.
const ACCENT_CHIP: Record<string, string> = {
  "chart-1": "bg-chart-1/12 text-chart-1",
  "chart-2": "bg-chart-2/16 text-chart-2",
  "chart-3": "bg-chart-3/14 text-chart-3",
  "chart-4": "bg-chart-4/12 text-chart-4",
  "chart-5": "bg-chart-5/14 text-chart-5",
}

export function accentChipClass(accent: string): string {
  return ACCENT_CHIP[accent] ?? ACCENT_CHIP["chart-1"]
}

/*
 * The line on each card's left edge: the module's colour, fading as it falls.
 * Static entries — the scanner cannot see a class built at runtime — and the
 * primary entry is for the start card, whose colour IS the shop's.
 */
const ACCENT_EDGE: Record<string, string> = {
  primary: "bg-linear-to-b from-primary to-primary/25",
  "chart-1": "bg-linear-to-b from-chart-1 to-chart-1/25",
  "chart-2": "bg-linear-to-b from-chart-2 to-chart-2/25",
  "chart-3": "bg-linear-to-b from-chart-3 to-chart-3/25",
  "chart-4": "bg-linear-to-b from-chart-4 to-chart-4/25",
  "chart-5": "bg-linear-to-b from-chart-5 to-chart-5/25",
}

export function accentEdgeClass(accent: string): string {
  return ACCENT_EDGE[accent] ?? ACCENT_EDGE["chart-1"]
}

function labelOf(def: { label: string }, values: Record<string, unknown>) {
  const custom = values.label
  return typeof custom === "string" && custom.trim().length > 0
    ? custom.trim()
    : def.label
}

export interface ElementCardProps {
  nodeType: string
  values: Record<string, unknown>
  locked?: boolean
  selected?: boolean
  /** Live facts for a module card. See lib/flow/glance.ts. */
  glance?: ModuleGlance
  /** Position in the entrance stagger; absent means no ceremony. */
  enterIndex?: number
  /** The module's own accent, icon and tagline; registry defaults otherwise. */
  accent?: string | null
  icon?: string | null
  tagline?: string | null
  className?: string
}

/**
 * The visual card, free of React Flow context so it can be rendered (and
 * tested) on its own.
 */
export function ElementCard({
  nodeType,
  values,
  locked = false,
  selected = false,
  glance,
  enterIndex,
  accent,
  icon,
  tagline,
  className,
}: ElementCardProps) {
  const def = resolveNodeType(nodeType)
  const isModule = def.type === "module"
  const isStart = def.type === "start"
  const edgeAccent = accent ?? (isStart ? "primary" : def.accent)
  const tier = typeof values.tier === "string" ? values.tier : null
  const badgeText = isModule
    ? tier
      ? `${tier.charAt(0).toUpperCase()}${tier.slice(1)}`
      : "Module"
    : isStart
      ? def.label
      : CATEGORY_LABELS[def.category]

  return (
    <div
      data-slot="element-card"
      data-locked={locked ? "true" : undefined}
      /*
        The lift is on THIS element, never the React Flow wrapper — the wrapper
        is positioned with a transform the library owns, and animating it would
        fight every drag.
      */
      style={
        enterIndex !== undefined
          ? ({ "--arrive-delay": `${enterIndex * 70}ms` } as React.CSSProperties)
          : undefined
      }
      className={cn(
        "group relative w-62 rounded-xl bg-card p-4 text-left shadow-node ring-1 ring-border lg:w-52 lg:rounded-lg lg:p-3",
        "transition-[box-shadow,translate,scale] duration-200 hover:-translate-y-0.5 hover:shadow-node-hover active:scale-[0.99] active:shadow-node motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100",
        enterIndex !== undefined && "node-arrive",
        // A module card is a door, and a door reads wider than a step —
        // wide enough that its WHOLE catalog tagline sits on one line. On
        // isModule too, not just glance: the Client Manager carries no glance
        // and was left at step width, wrapping its tagline.
        (glance || isModule) && "w-80 lg:w-72",
        /*
          The heart of the board dresses like it: a quiet gradient of the
          shop's own colour over bg-card (background-image over
          background-color — different properties, no conflict), fading to
          primary/0 rather than transparent to dodge oklab's muddy
          transparent-black midpoint. Selection sits later in this list, so
          its ring still wins.
        */
        isStart && "bg-linear-to-br from-primary/10 to-primary/0 ring-primary/25",
        selected && "ring-2 ring-primary shadow-node-selected hover:shadow-node-selected",
        locked && "opacity-70",
        className
      )}
    >
      {/* A floating pill rather than a painted edge: at the card's corner a
          full-height bar fought the border radius and read as overlap. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-3 bottom-3 left-1.5 w-1 rounded-full",
          accentEdgeClass(edgeAccent)
        )}
      />

      {glance?.count ? (
        /* Same dress as the nav badge: red because it asks to be dealt with,
           gone at zero so an empty badge never looks like a bug. */
        <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground tabular-nums ring-2 ring-background">
          {glance.count > 99 ? "99+" : glance.count}
        </span>
      ) : null}

      <div className="flex items-center gap-3">
        <span className="relative shrink-0 self-center">
          {glance?.logoUrl || glance?.logoName ? (
            /* The shop's own mark, framed the way the owner framed it — the
               same component as the public page, so the two cannot drift. */
            <LogoMask
              url={glance.logoUrl ?? null}
              name={glance.logoName ?? null}
              crop={glance.logoCrop}
              className="size-12 text-base lg:size-10 lg:text-sm"
            />
          ) : (
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-lg lg:size-8 lg:rounded-md",
                accentChipClass(accent ?? def.accent)
              )}
            >
              <NodeIcon name={icon ?? def.icon} className="size-5 lg:size-4" />
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium text-foreground lg:text-[13px]">
              {labelOf(def, values)}
            </p>
            {locked ? (
              <Lock
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-label="Locked"
              />
            ) : null}
          </div>
          {isModule && tagline ? (
            /* A catalog tagline is a label, not prose: one line, truncated —
               the owner's OWN sentence on the start card keeps its two. */
            <p className="truncate text-xs text-muted-foreground lg:text-[11px]">
              {tagline}
            </p>
          ) : null}
          {glance ? (
            <>
              {isStart && labelOf(def, values) !== def.label ? (
                <Badge variant="outline" className="mt-1 mb-0.5 font-normal">
                  {badgeText}
                </Badge>
              ) : null}
              {glance.tagline ? (
                /*
                  The owner's own sentence, allowed a second line: facts
                  truncate, but prose cut mid-word reads as a mistake.
                */
                <p className="line-clamp-2 text-xs text-pretty text-muted-foreground lg:text-[11px]">
                  {glance.tagline}
                </p>
              ) : null}
              {glance.lines.map((line) => (
                <p
                  key={line}
                  className="truncate text-xs text-muted-foreground lg:text-[11px]"
                >
                  {line}
                </p>
              ))}
            </>
          ) : isModule ? null : (
            <p className="truncate text-xs text-muted-foreground lg:text-[11px]">
              {summarise(nodeType, values)}
            </p>
          )}
        </div>

        {isModule ? (
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground transition-[translate,color] duration-200 group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
            aria-hidden="true"
          />
        ) : null}
      </div>

      {/* Modules and the start card carry no footer: the tier tag and "Tap
          to open" were chrome about the app, not facts about the shop. The
          inner builder's elements keep their category and lock hints. */}
      {isStart || isModule ? null : (
        <div className="mt-3 flex items-center gap-2">
          <Badge variant="outline" className="font-normal">
            {badgeText}
          </Badge>
          {locked ? (
            <span className="text-xs text-muted-foreground">
              Upgrade to use
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}

// Fingertip-sized: 16px of visible dot with a ~36px invisible hit area. The
// `!` suffixes beat React Flow's own unlayered stylesheet.
const HANDLE_CLASS =
  "size-4! border-2! shadow-sm transition-[scale] duration-150 hover:scale-125 motion-reduce:transition-none motion-reduce:hover:scale-100 after:absolute after:-inset-2.5 after:rounded-full after:content-['']"

/**
 * The Clients marker: a circle, not a card — it is an ANNOTATION of the
 * board, not a step on it. Dashed, because nothing about it is configured or
 * configurable; its arrows into Booking and Website are the whole message.
 * The one handle is invisible and disabled: React Flow needs it to anchor the
 * edges, nobody needs to grab it.
 */
function ClientsMarker({
  note,
  handleSide,
  enterIndex,
}: {
  note: string
  handleSide: "left" | "right"
  enterIndex?: number
}) {
  return (
    <div
      className={cn(
        "flex size-36 flex-col items-center justify-center gap-1.5 rounded-lg bg-card px-3 text-center shadow-node ring-1 ring-border",
        enterIndex !== undefined && "node-arrive"
      )}
      style={
        enterIndex !== undefined
          ? ({ "--arrive-delay": `${enterIndex * 70}ms` } as React.CSSProperties)
          : undefined
      }
    >
      {/* Visible, like every other connector — but only an anchor: the
          wire it holds is presentation, not the user's to redraw. */}
      <Handle
        type="source"
        position={handleSide === "right" ? Position.Right : Position.Left}
        isConnectable={false}
        className="pointer-events-none! size-4! border-2! shadow-sm"
        aria-hidden="true"
      />
      <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Users className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold">Clients</p>
      <p className="text-[11px] leading-tight text-muted-foreground">{note}</p>
    </div>
  )
}

/** The door-side connector a Clients wire enters, when this card has one. */
function SideTarget({ side }: { side: "left" | "right" }) {
  return (
    <Handle
      type="target"
      id={`side-${side}`}
      position={side === "left" ? Position.Left : Position.Right}
      isConnectable={false}
      className="pointer-events-none! size-4! border-2! shadow-sm"
      aria-hidden="true"
    />
  )
}

/*
 * The rocket's two cut-off sections as glowing wireframes: a triangulated
 * mesh with lit vertices, layered neon drop-shadows, and a gradient plume —
 * plexus-style, in the shop's own colour so every palette gets its own neon.
 * The glow is a static CSS filter on a small SVG: composited once, no
 * animation cost. The dashed edge is still the cut — the body between the
 * sections is the elements themselves.
 */

/** One neon vertex. */
function MeshDot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r="2" fill="currentColor" fillOpacity="0.9" />
}

const NEON =
  "pointer-events-none text-primary [filter:drop-shadow(0_0_2px_var(--color-primary))_drop-shadow(0_0_10px_var(--color-primary))]"

function RocketSection({
  part,
  enterIndex,
}: {
  part: "nose" | "booster"
  enterIndex?: number
}) {
  const style =
    enterIndex !== undefined
      ? ({ "--arrive-delay": `${enterIndex * 70}ms` } as React.CSSProperties)
      : undefined

  if (part === "nose") {
    /*
      Vertices of the mesh: the tip, the base, and the mid-edge points the
      triangulation hangs from.
    */
    const dots: [number, number][] = [
      [150, 8],
      [89, 80],
      [211, 80],
      [150, 96],
      [28, 152],
      [96, 152],
      [204, 152],
      [272, 152],
    ]
    return (
      <svg
        viewBox="0 0 300 160"
        width={300}
        height={160}
        aria-hidden="true"
        className={cn(NEON, enterIndex !== undefined && "node-arrive")}
        style={style}
      >
        {/* A breath of fill so the mesh reads as a solid catching light. */}
        <path d="M150 8 L28 152 L150 152 Z" fill="currentColor" fillOpacity="0.08" />
        <path d="M150 8 L272 152 L150 152 Z" fill="currentColor" fillOpacity="0.04" />
        {/* The outline. */}
        <path
          d="M28 152 L150 8 L272 152"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.8"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* The mesh. */}
        <path
          d="M150 8 L89 80 M150 8 L211 80 M150 8 L150 96 M89 80 L150 96 M211 80 L150 96 M89 80 L96 152 M211 80 L204 152 M150 96 L96 152 M150 96 L204 152 M89 80 L28 152 M211 80 L272 152"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1"
        />
        {dots.map(([x, y]) => (
          <MeshDot key={`${x}-${y}`} x={x} y={y} />
        ))}
        {/* The cut. */}
        <line
          x1="28"
          y1="152"
          x2="272"
          y2="152"
          stroke="currentColor"
          strokeOpacity="0.5"
          strokeWidth="1.5"
          strokeDasharray="8 7"
        />
      </svg>
    )
  }

  const dots: [number, number][] = [
    [64, 6],
    [176, 6],
    [120, 6],
    [52, 48],
    [188, 48],
    [120, 52],
    [40, 92],
    [120, 92],
    [200, 92],
  ]
  return (
    <svg
      viewBox="0 0 240 200"
      width={240}
      height={200}
      aria-hidden="true"
      className={cn(NEON, enterIndex !== undefined && "node-arrive")}
      style={style}
    >
      <defs>
        <radialGradient id="raket-plume" cx="50%" cy="20%" r="85%">
          <stop offset="0%" stopColor="var(--color-warning)" stopOpacity="0.95" />
          <stop offset="45%" stopColor="var(--color-destructive)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--color-destructive)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* The bell's faces. */}
      <path d="M120 6 L64 6 L40 92 L120 92 Z" fill="currentColor" fillOpacity="0.08" />
      <path d="M120 6 L176 6 L200 92 L120 92 Z" fill="currentColor" fillOpacity="0.04" />
      {/* The outline. */}
      <path
        d="M64 6 L40 92 L200 92 L176 6"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.8"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* The mesh. */}
      <path
        d="M64 6 L52 48 M176 6 L188 48 M120 6 L120 52 M52 48 L120 52 M188 48 L120 52 M52 48 L40 92 M188 48 L200 92 M120 52 L120 92 M52 48 L120 92 M120 52 L40 92 M120 52 L200 92"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1"
      />
      {dots.map(([x, y]) => (
        <MeshDot key={`${x}-${y}`} x={x} y={y} />
      ))}
      {/* The cut. */}
      <line
        x1="64"
        y1="6"
        x2="176"
        y2="6"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="1.5"
        strokeDasharray="8 7"
      />
      {/* The plume: a gradient glow with a hot core. */}
      <g className="flame-flicker">
        <path
          d="M120 96 C 152 118 148 152 120 196 C 92 152 88 118 120 96 Z"
          fill="url(#raket-plume)"
        />
        <path
          d="M120 100 C 134 114 133 134 120 160 C 107 134 106 114 120 100 Z"
          fill="var(--color-warning)"
          fillOpacity="0.9"
        />
      </g>
    </svg>
  )
}

export function ElementNode({ data, selected }: NodeProps<BuilderNode>) {
  if (data.nodeType === "rocket") {
    return (
      <RocketSection
        part={data.values.part === "booster" ? "booster" : "nose"}
        enterIndex={data.enterIndex}
      />
    )
  }
  if (data.nodeType === "clients") {
    return (
      <ClientsMarker
        note={
          typeof data.values.note === "string"
            ? data.values.note
            : "Dito papasok ang mga suki."
        }
        handleSide={data.values.handle === "right" ? "right" : "left"}
        enterIndex={data.enterIndex}
      />
    )
  }

  return (
    <div className="relative">
      {/* The start node is the root: nothing connects INTO it, so it carries
          no target handle — the half-circle on its top edge was a socket for
          a plug that cannot exist. */}
      {data.nodeType !== "start" ? (
        <Handle
          type="target"
          position={Position.Top}
          className={HANDLE_CLASS}
          aria-label="Connect a step above"
        />
      ) : null}
      {data.sideTarget ? <SideTarget side={data.sideTarget} /> : null}
      <ElementCard
        nodeType={data.nodeType}
        values={data.values}
        locked={data.locked}
        selected={selected}
        glance={data.glance}
        enterIndex={data.enterIndex}
        accent={data.accent}
        icon={data.icon}
        tagline={data.tagline}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className={HANDLE_CLASS}
        aria-label="Connect a step below"
      />
    </div>
  )
}

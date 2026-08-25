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

/**
 * The rocket's two cut-off sections. The board's metaphor made literal: the
 * nose rides above Your business, the booster below the last element, and
 * everything between IS the body. Each section's cut edge is dashed, the way
 * a cutaway diagram says "this continues". Sized by the page to the actual
 * cluster, decorative only.
 */
function RocketSection({
  part,
  width,
  enterIndex,
}: {
  part: "nose" | "booster"
  width: number
  enterIndex?: number
}) {
  const w = Math.max(width, 400)
  const mid = w / 2
  const style =
    enterIndex !== undefined
      ? ({ "--arrive-delay": `${enterIndex * 70}ms` } as React.CSSProperties)
      : undefined

  if (part === "nose") {
    const h = 180
    return (
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width={w}
        height={h}
        aria-hidden="true"
        className={cn(
          "pointer-events-none text-primary",
          enterIndex !== undefined && "node-arrive"
        )}
        style={style}
      >
        {/* The cone: shoulders as wide as the body below it. */}
        <path
          d={`M ${mid} 6 C ${mid + w * 0.28} 40 ${w - 10} 110 ${w - 10} ${h} L 10 ${h} C 10 110 ${mid - w * 0.28} 40 ${mid} 6 Z`}
          fill="currentColor"
          fillOpacity="0.07"
          stroke="none"
        />
        <path
          d={`M 10 ${h} C 10 110 ${mid - w * 0.28} 40 ${mid} 6 C ${mid + w * 0.28} 40 ${w - 10} 110 ${w - 10} ${h}`}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="2"
        />
        {/* The porthole. */}
        <circle
          cx={mid}
          cy={h - 70}
          r="22"
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="2"
        />
        {/* The cut. */}
        <line
          x1="10"
          y1={h - 1}
          x2={w - 10}
          y2={h - 1}
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="2"
          strokeDasharray="10 8"
        />
      </svg>
    )
  }

  const h = 200
  const bells = [mid - w * 0.28, mid, mid + w * 0.28]
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      aria-hidden="true"
      className={cn(
        "pointer-events-none text-primary",
        enterIndex !== undefined && "node-arrive"
      )}
      style={style}
    >
      {/* The skirt, flaring from the cut. */}
      <path
        d={`M 10 1 L ${w - 10} 1 L ${w - 40} 70 L 40 70 Z`}
        fill="currentColor"
        fillOpacity="0.07"
      />
      <path
        d={`M 10 1 L 40 70 M ${w - 10} 1 L ${w - 40} 70`}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="2"
      />
      {/* The cut. */}
      <line
        x1="10"
        y1="1"
        x2={w - 10}
        y2="1"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeDasharray="10 8"
      />
      {/* Three bells, three flames. */}
      {bells.map((cx) => (
        <g key={cx}>
          <path
            d={`M ${cx - 22} 70 L ${cx + 22} 70 L ${cx + 34} 104 L ${cx - 34} 104 Z`}
            fill="currentColor"
            fillOpacity="0.14"
            stroke="currentColor"
            strokeOpacity="0.4"
            strokeWidth="2"
          />
          <g className="flame-flicker">
            <path
              d={`M ${cx} 108 C ${cx + 20} 124 ${cx + 18} 148 ${cx} 182 C ${cx - 18} 148 ${cx - 20} 124 ${cx} 108 Z`}
              fill="var(--color-destructive)"
              fillOpacity="0.4"
            />
            <path
              d={`M ${cx} 112 C ${cx + 12} 126 ${cx + 11} 142 ${cx} 164 C ${cx - 11} 142 ${cx - 12} 126 ${cx} 112 Z`}
              fill="var(--color-warning)"
              fillOpacity="0.8"
            />
          </g>
        </g>
      ))}
    </svg>
  )
}

export function ElementNode({ data, selected }: NodeProps<BuilderNode>) {
  if (data.nodeType === "rocket") {
    return (
      <RocketSection
        part={data.values.part === "booster" ? "booster" : "nose"}
        width={typeof data.values.w === "number" ? data.values.w : 700}
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

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
 * The rocket's two cut-off sections as 3D wireframes: curved silhouettes,
 * elliptical cross-section RINGS whose hidden halves are dashed — the
 * draughtsman's trick that makes a flat drawing read as a solid — and
 * meridian lines down the surface. The glow is deliberately tight: one
 * crisp halo, one faint bloom at half strength, so the linework stays sharp.
 * The sliced ellipse at each section's open end IS the cut; the body between
 * the sections is the elements themselves.
 */

const NEON =
  "pointer-events-none text-primary [filter:drop-shadow(0_0_1px_var(--color-primary))_drop-shadow(0_0_5px_color-mix(in_oklab,var(--color-primary)_45%,transparent))]"

/** A cross-section ring: solid where it faces you, dashed where it hides. */
function Ring({
  cx,
  cy,
  rx,
  ry,
}: {
  cx: number
  cy: number
  rx: number
  ry: number
}) {
  return (
    <>
      <path
        d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy}`}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="1.2"
      />
      <path
        d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
    </>
  )
}

function RocketSection({
  part,
  w = 700,
  h = 700,
  ww = 240,
  wt = 200,
  wh = 200,
  enterIndex,
}: {
  part: "nose" | "booster" | "hull"
  w?: number
  h?: number
  /** Wing width each side, wing top, wing height — hull only. */
  ww?: number
  wt?: number
  wh?: number
  enterIndex?: number
}) {
  const style =
    enterIndex !== undefined
      ? ({ "--arrive-delay": `${enterIndex * 70}ms` } as React.CSSProperties)
      : undefined

  if (part === "hull") {
    /*
      The fuselage barrel plus two swept delta WINGS — the Clients boxes ride
      inside the wings, sources docked to the ship's sides. Same grammar as
      the sections: curved silhouettes, dashed cut rings at both ends, mid
      rings with hidden halves dashed, meridians. Faint and glowless — it
      lives behind everything.
    */
    const bw = w - 2 * ww
    const L = ww + 10
    const R = w - ww - 10
    const rx = bw / 2 - 10
    const bow = bw * 0.012
    const wb = wt + wh
    const mid = ww + bw / 2
    return (
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width={w}
        height={h}
        aria-hidden="true"
        className="pointer-events-none text-primary overflow-visible"
      >
        {/* The wings: swept deltas rooted on the barrel. */}
        <path
          d={`M ${L} ${wt} C ${ww - 70} ${wt + wh * 0.18} ${70} ${wt + wh * 0.45} ${12} ${wt + wh * 0.78} L ${34} ${wb} C ${ww * 0.5} ${wb - 8} ${ww * 0.85} ${wb - 4} ${L} ${wb} Z`}
          fill="currentColor"
          fillOpacity="0.045"
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d={`M ${R} ${wt} C ${w - ww + 70} ${wt + wh * 0.18} ${w - 70} ${wt + wh * 0.45} ${w - 12} ${wt + wh * 0.78} L ${w - 34} ${wb} C ${w - ww * 0.5} ${wb - 8} ${w - ww * 0.85} ${wb - 4} ${R} ${wb} Z`}
          fill="currentColor"
          fillOpacity="0.045"
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* A rib along each wing. */}
        <path
          d={`M ${L} ${wt + wh * 0.45} C ${ww * 0.6} ${wt + wh * 0.55} ${ww * 0.3} ${wt + wh * 0.68} ${60} ${wt + wh * 0.82} M ${R} ${wt + wh * 0.45} C ${w - ww * 0.6} ${wt + wh * 0.55} ${w - ww * 0.3} ${wt + wh * 0.68} ${w - 60} ${wt + wh * 0.82}`}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeWidth="1"
        />
        {/* The barrel's skin. */}
        <path
          d={`M ${L} 16 C ${L - bow} ${h * 0.33} ${L - bow} ${h * 0.66} ${L} ${h - 16} A ${rx} 13 0 0 0 ${R} ${h - 16} C ${R + bow} ${h * 0.66} ${R + bow} ${h * 0.33} ${R} 16 A ${rx} 13 0 0 0 ${L} 16 Z`}
          fill="currentColor"
          fillOpacity="0.045"
        />
        {/* The sides. */}
        <path
          d={`M ${L} 16 C ${L - bow} ${h * 0.33} ${L - bow} ${h * 0.66} ${L} ${h - 16} M ${R} 16 C ${R + bow} ${h * 0.33} ${R + bow} ${h * 0.66} ${R} ${h - 16}`}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="1.5"
        />
        {/* The cut rings at both ends: this section continues. */}
        {[16, h - 16].map((cy) => (
          <g key={cy}>
            <path
              d={`M ${L} ${cy} A ${rx} 13 0 0 0 ${R} ${cy}`}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.3"
              strokeWidth="1.2"
              strokeDasharray="8 7"
            />
            <path
              d={`M ${L} ${cy} A ${rx} 13 0 0 1 ${R} ${cy}`}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.12"
              strokeWidth="1"
              strokeDasharray="4 5"
            />
          </g>
        ))}
        {/* Mid rings. */}
        {[0.38, 0.7].map((t) => (
          <g key={t}>
            <path
              d={`M ${L} ${h * t} A ${rx} 13 0 0 0 ${R} ${h * t}`}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.16"
              strokeWidth="1"
            />
            <path
              d={`M ${L} ${h * t} A ${rx} 13 0 0 1 ${R} ${h * t}`}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.07"
              strokeWidth="1"
              strokeDasharray="4 5"
            />
          </g>
        ))}
        {/* Meridians. */}
        <path
          d={`M ${ww + bw * 0.28} 22 C ${ww + bw * 0.26} ${h * 0.4} ${ww + bw * 0.26} ${h * 0.66} ${ww + bw * 0.28} ${h - 22} M ${mid} 26 L ${mid} ${h - 26} M ${ww + bw * 0.72} 22 C ${ww + bw * 0.74} ${h * 0.4} ${ww + bw * 0.74} ${h * 0.66} ${ww + bw * 0.72} ${h - 22}`}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeWidth="1"
        />
      </svg>
    )
  }

  if (part === "nose") {
    return (
      <svg
        viewBox="0 0 300 176"
        width={300}
        height={176}
        aria-hidden="true"
        className={cn(NEON, enterIndex !== undefined && "node-arrive")}
        style={style}
      >
        {/* The lit and shaded halves of the cone. */}
        <path
          d="M150 8 C 118 22 62 70 28 152 L 150 152 Z"
          fill="currentColor"
          fillOpacity="0.1"
        />
        <path
          d="M150 8 C 182 22 238 70 272 152 L 150 152 Z"
          fill="currentColor"
          fillOpacity="0.04"
        />
        {/* The silhouette: a rocket tip, not a pyramid. */}
        <path
          d="M28 152 C 62 70 118 22 150 8 C 182 22 238 70 272 152"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.85"
          strokeWidth="1.5"
        />
        {/* Meridians curving down the surface. */}
        <path
          d="M150 8 C 132 60 112 110 96 152 M150 8 C 168 60 188 110 204 152 M150 8 L150 152"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        {/* Cross-sections; the base ring is the CUT itself. */}
        <Ring cx={150} cy={96} rx={78} ry={10} />
        <Ring cx={150} cy={152} rx={122} ry={14} />
        <circle cx="150" cy="8" r="2" fill="currentColor" fillOpacity="0.9" />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 240 242"
      width={240}
      height={242}
      aria-hidden="true"
      className={cn(
        NEON,
        "overflow-visible",
        enterIndex !== undefined && "node-arrive"
      )}
      style={style}
    >
      <defs>
        <radialGradient id="raket-plume" cx="50%" cy="20%" r="85%">
          <stop offset="0%" stopColor="var(--color-warning)" stopOpacity="0.95" />
          <stop offset="45%" stopColor="var(--color-destructive)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--color-destructive)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* The bell's lit and shaded halves, flaring like a nozzle. */}
      <path
        d="M64 14 C 58 46 48 72 40 92 L 120 103 L 120 14 Z"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <path
        d="M176 14 C 182 46 192 72 200 92 L 120 103 L 120 14 Z"
        fill="currentColor"
        fillOpacity="0.04"
      />
      {/* The silhouette. */}
      <path
        d="M64 14 C 58 46 48 72 40 92 M176 14 C 182 46 192 72 200 92"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.85"
        strokeWidth="1.5"
      />
      {/* Meridians. */}
      <path
        d="M92 12 C 88 44 82 74 78 98 M148 12 C 152 44 158 74 162 98 M120 14 L120 102"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="1"
      />
      {/* Rings: the top one is the CUT, the lip is the exhaust's mouth. */}
      <Ring cx={120} cy={14} rx={56} ry={8} />
      <Ring cx={120} cy={58} rx={68} ry={9} />
      <Ring cx={120} cy={92} rx={80} ry={11} />
      {/* The plume: a gradient glow with a hot core, well clear of the bell. */}
      <g className="flame-flicker">
        <path
          d="M120 132 C 150 154 146 190 120 236 C 94 190 90 154 120 132 Z"
          fill="url(#raket-plume)"
        />
        <path
          d="M120 136 C 133 150 132 172 120 198 C 108 172 107 150 120 136 Z"
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
        part={
          data.values.part === "booster"
            ? "booster"
            : data.values.part === "hull"
              ? "hull"
              : "nose"
        }
        w={typeof data.values.w === "number" ? data.values.w : undefined}
        h={typeof data.values.h === "number" ? data.values.h : undefined}
        ww={typeof data.values.ww === "number" ? data.values.ww : undefined}
        wt={typeof data.values.wt === "number" ? data.values.wt : undefined}
        wh={typeof data.values.wh === "number" ? data.values.wh : undefined}
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

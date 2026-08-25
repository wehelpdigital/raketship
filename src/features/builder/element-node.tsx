"use client"

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import {
  Boxes,
  CalendarCheck,
  CalendarPlus,
  ChevronRight,
  CreditCard,
  GitBranch,
  Lock,
  Mail,
  MessageSquare,
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
  Boxes,
  CalendarCheck,
  CalendarPlus,
  CreditCard,
  GitBranch,
  Mail,
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
  /** The module's own accent and icon; the registry's defaults otherwise. */
  accent?: string | null
  icon?: string | null
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
      ? def.short
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
        // A module card is a door, and a door reads wider than a step. The
        // business card is the front of the whole shop, and reads widest.
        glance && "w-64 lg:w-60",
        glance && isStart && "w-72 lg:w-64",
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
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-1 rounded-l-xl lg:rounded-l-lg",
          accentEdgeClass(edgeAccent)
        )}
      />

      <div className="flex items-start gap-3">
        <span className="relative shrink-0">
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
          {glance?.live ? (
            /* Breathing, not blinking: it means "open", not "alarm". The word
               is in the glance line; this is the mark for it. */
            <span
              className="live-dot absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-success ring-2 ring-card"
              aria-hidden="true"
            />
          ) : null}
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
          {glance ? (
            <>
              {isStart ? (
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
          ) : (
            <p className="truncate text-xs text-muted-foreground lg:text-[11px]">
              {summarise(nodeType, values)}
            </p>
          )}
        </div>

        {isModule ? (
          <ChevronRight
            className="mt-2 size-4 shrink-0 text-muted-foreground transition-[translate,color] duration-200 group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
            aria-hidden="true"
          />
        ) : null}
      </div>

      {isStart ? null : (
      <div className="mt-3 flex items-center gap-2">
        <Badge variant="outline" className="font-normal">
          {badgeText}
        </Badge>
        {isModule ? (
          <span className="text-xs text-muted-foreground">Tap to open</span>
        ) : null}
        {locked ? (
          <span className="text-xs text-muted-foreground">Upgrade to use</span>
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

export function ElementNode({ data, selected }: NodeProps<BuilderNode>) {
  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        className={HANDLE_CLASS}
        aria-label="Connect a step above"
      />
      <ElementCard
        nodeType={data.nodeType}
        values={data.values}
        locked={data.locked}
        selected={selected}
        glance={data.glance}
        enterIndex={data.enterIndex}
        accent={data.accent}
        icon={data.icon}
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

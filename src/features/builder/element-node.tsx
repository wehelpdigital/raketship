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
  className,
}: ElementCardProps) {
  const def = resolveNodeType(nodeType)
  const isModule = def.type === "module"
  const tier = typeof values.tier === "string" ? values.tier : null
  const badgeText = isModule
    ? tier
      ? `${tier.charAt(0).toUpperCase()}${tier.slice(1)}`
      : "Module"
    : def.type === "start"
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
        "w-62 rounded-xl bg-card p-4 text-left shadow-sm ring-1 ring-border lg:w-52 lg:rounded-lg lg:p-3",
        "transition-[box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        enterIndex !== undefined && "node-arrive",
        // A module card is a door, and a door reads wider than a step.
        glance && "w-64 lg:w-60",
        selected && "ring-2 ring-primary",
        locked && "opacity-70",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="relative shrink-0">
          {glance?.logoUrl || (glance?.logoName && glance.lines.length > 1) ? (
            /* The shop's own mark, framed the way the owner framed it — the
               same component as the public page, so the two cannot drift. */
            <LogoMask
              url={glance.logoUrl ?? null}
              name={glance.logoName ?? null}
              crop={glance.logoCrop}
              className="size-10 text-sm lg:size-9"
            />
          ) : (
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-lg lg:size-8 lg:rounded-md",
                accentChipClass(def.accent)
              )}
            >
              <NodeIcon name={def.icon} className="size-5 lg:size-4" />
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
            glance.lines.map((line) => (
              <p
                key={line}
                className="truncate text-xs text-muted-foreground lg:text-[11px]"
              >
                {line}
              </p>
            ))
          ) : (
            <p className="truncate text-xs text-muted-foreground lg:text-[11px]">
              {summarise(nodeType, values)}
            </p>
          )}
        </div>

        {isModule ? (
          <ChevronRight
            className="mt-2 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Badge variant="outline" className="font-normal">
          {badgeText}
        </Badge>
        {glance?.swatches?.length ? (
          <span className="flex items-center gap-1" aria-hidden="true">
            {glance.swatches.map((colour) => (
              <span
                key={colour}
                className="size-3 rounded-full ring-1 ring-border"
                /* The swatch IS the colour — the one inline-style exception. */
                style={{ backgroundColor: colour }}
              />
            ))}
          </span>
        ) : null}
        {isModule ? (
          <span className="text-xs text-muted-foreground">Tap to open</span>
        ) : null}
        {locked ? (
          <span className="text-xs text-muted-foreground">Upgrade to use</span>
        ) : null}
      </div>
    </div>
  )
}

// Fingertip-sized: 16px of visible dot with a ~36px invisible hit area. The
// `!` suffixes beat React Flow's own unlayered stylesheet.
const HANDLE_CLASS =
  "size-4! border-2! shadow-sm after:absolute after:-inset-2.5 after:rounded-full after:content-['']"

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

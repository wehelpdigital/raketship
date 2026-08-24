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
  className,
}: ElementCardProps) {
  const def = resolveNodeType(nodeType)
  const isModule = def.type === "module"
  const tier = typeof values.tier === "string" ? values.tier : null
  const badgeText = isModule
    ? tier
      ? `${tier.charAt(0).toUpperCase()}${tier.slice(1)}`
      : "Module"
    : CATEGORY_LABELS[def.category]

  return (
    <div
      data-slot="element-card"
      data-locked={locked ? "true" : undefined}
      className={cn(
        "w-62 rounded-xl bg-card p-4 text-left shadow-sm ring-1 ring-border transition-shadow lg:w-52 lg:rounded-lg lg:p-3",
        selected && "ring-2 ring-primary",
        locked && "opacity-70",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg lg:size-8 lg:rounded-md",
            accentChipClass(def.accent)
          )}
        >
          <NodeIcon name={def.icon} className="size-5 lg:size-4" />
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
          <p className="truncate text-xs text-muted-foreground lg:text-[11px]">
            {summarise(nodeType, values)}
          </p>
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

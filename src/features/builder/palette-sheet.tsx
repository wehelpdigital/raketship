"use client"

import Link from "next/link"
import { ChevronRight, Lock } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  CATEGORY_LABELS,
  nodeTypesForScope,
  type NodeCategory,
  type NodeScope,
  type NodeTypeDef,
} from "@/lib/flow/registry"
import { cn } from "@/lib/utils"

import { NodeIcon, accentChipClass } from "@/features/builder/element-node"

/** Payload key for the desktop drag-and-drop path. */
export const DRAG_MIME = "application/x-raketship-element"

const CATEGORY_ORDER: NodeCategory[] = [
  "trigger",
  "delay",
  "action",
  "logic",
  "data",
]

export interface PaletteSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scope: NodeScope
  moduleId?: string
  unlockedTypes: readonly string[]
  /** Types already at their `maxPerFlow` — hidden rather than offered. */
  atCapacity?: readonly string[]
  onAdd: (type: string) => void
}

function isLocked(
  def: NodeTypeDef,
  scope: NodeScope,
  unlockedTypes: readonly string[]
): boolean {
  if (def.type === "start" || def.type === "module") return false
  if (scope !== "module") return false
  return !unlockedTypes.includes(def.type)
}

function upgradeHref(def: NodeTypeDef, moduleId?: string): string {
  const id = def.moduleId ?? moduleId
  return id ? `/marketplace/${id}` : "/marketplace"
}

function ElementRow({
  def,
  locked,
  moduleId,
  onAdd,
  onDragStarted,
}: {
  def: NodeTypeDef
  locked: boolean
  moduleId?: string
  onAdd: (type: string) => void
  onDragStarted: () => void
}) {
  const chip = (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg",
        accentChipClass(def.accent),
        locked && "opacity-60"
      )}
    >
      <NodeIcon name={def.icon} className="size-5" />
    </span>
  )

  const text = (
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-1.5">
        <span className="truncate text-sm font-medium text-foreground">
          {def.label}
        </span>
        {locked ? (
          <Lock className="size-3.5 shrink-0 text-muted-foreground" />
        ) : null}
      </span>
      <span className="mt-0.5 block text-xs text-pretty text-muted-foreground">
        {def.description}
      </span>
    </span>
  )

  if (locked) {
    return (
      <Link
        href={upgradeHref(def, moduleId)}
        className="flex min-h-14 w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
      >
        {chip}
        {text}
        <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary">
          Upgrade
          <ChevronRight className="size-3.5" />
        </span>
      </Link>
    )
  }

  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_MIME, def.type)
        event.dataTransfer.effectAllowed = "move"
        // Close after the browser has taken its drag snapshot, otherwise
        // unmounting the source element cancels the drag.
        window.setTimeout(onDragStarted, 0)
      }}
      onClick={() => onAdd(def.type)}
      className="flex min-h-14 w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted active:bg-muted"
    >
      {chip}
      {text}
    </button>
  )
}

function MarketplaceRow() {
  return (
    <Link
      href="/marketplace"
      className="flex min-h-14 w-full items-center gap-3 rounded-lg bg-muted/50 p-2 text-left transition-colors hover:bg-muted"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-chart-1/12 text-chart-1">
        <NodeIcon name="Boxes" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          Get a module
        </span>
        <span className="mt-0.5 block text-xs text-pretty text-muted-foreground">
          Modules join your raket from the marketplace — tingi lang, isa-isa.
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}

export function PaletteSheet({
  open,
  onOpenChange,
  scope,
  moduleId,
  unlockedTypes,
  atCapacity = [],
  onAdd,
}: PaletteSheetProps) {
  // A bare module node on the outer canvas would have no inner flow to open,
  // so modules join the raket from the marketplace instead.
  const available = nodeTypesForScope(scope, moduleId).filter(
    (def) =>
      !(scope === "raket" && def.type === "module") &&
      !atCapacity.includes(def.type)
  )
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: available.filter((def) => def.category === category),
  })).filter((group) => group.items.length > 0)

  return (
    <Sheet open={open} onOpenChange={(next) => onOpenChange(next)}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] rounded-t-xl pb-safe"
      >
        <SheetHeader>
          <SheetTitle>Add a step</SheetTitle>
          <SheetDescription>
            Tap to drop it on the canvas. On a computer you can also drag it
            where you want it.
          </SheetDescription>
        </SheetHeader>

        <div className="no-scrollbar min-h-0 space-y-6 overflow-y-auto px-4 pb-6">
          {scope === "raket" ? <MarketplaceRow /> : null}

          {groups.length === 0 && scope !== "raket" ? (
            <p className="text-sm text-pretty text-muted-foreground">
              Every step this module offers is already on the canvas. Upgrade
              the module to unlock more.
            </p>
          ) : null}

          {groups.map((group) => (
            <section key={group.category} className="space-y-3">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {CATEGORY_LABELS[group.category]}
              </h3>
              <div className="space-y-1">
                {group.items.map((def) => (
                  <ElementRow
                    key={def.type}
                    def={def}
                    locked={isLocked(def, scope, unlockedTypes)}
                    moduleId={moduleId}
                    onAdd={(type) => {
                      onOpenChange(false)
                      onAdd(type)
                    }}
                    onDragStarted={() => onOpenChange(false)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

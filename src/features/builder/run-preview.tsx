"use client"

import { ListOrdered } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { linearise, type CanvasEdge, type CanvasNode } from "@/lib/flow/mappers"
import { resolveNodeType, summarise } from "@/lib/flow/registry"
import { cn } from "@/lib/utils"

import { NodeIcon, accentChipClass } from "@/features/builder/element-node"

export interface RunPreviewProps {
  nodes: readonly CanvasNode[]
  edges: readonly CanvasEdge[]
  /** "icon" is the round button that lives on the canvas action bar. */
  variant?: "button" | "icon"
  className?: string
}

export function RunPreview({
  nodes,
  edges,
  variant = "button",
  className,
}: RunPreviewProps) {
  const ordered = linearise([...nodes], [...edges])
  const connected = new Set(edges.map((edge) => edge.target))

  return (
    <Sheet>
      <SheetTrigger
        render={
          variant === "icon" ? (
            <Button
              variant="outline"
              className={cn(
                "size-12 rounded-full bg-card p-0 shadow-lg",
                className
              )}
              aria-label="Preview run"
            />
          ) : (
            <Button variant="outline" className={cn("h-11", className)} />
          )
        }
      >
        <ListOrdered />
        {variant === "icon" ? null : "Preview run"}
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="max-h-[85dvh] rounded-t-xl pb-safe"
      >
        <SheetHeader>
          <SheetTitle>How this reads</SheetTitle>
          <SheetDescription>
            The order your steps run in, following the lines you drew.
          </SheetDescription>
        </SheetHeader>

        <div className="no-scrollbar min-h-0 overflow-y-auto px-4 pb-6">
          {ordered.length === 0 ? (
            <p className="text-sm text-pretty text-muted-foreground">
              Nothing on this canvas yet. Add your first step and it will show
              up here.
            </p>
          ) : (
            <ol className="space-y-3">
              {ordered.map((node, index) => {
                const def = resolveNodeType(node.data.nodeType)
                const values = node.data.values
                const label =
                  typeof values.label === "string" && values.label.trim()
                    ? values.label.trim()
                    : def.label
                const stray = index > 0 && !connected.has(node.id)

                return (
                  <li
                    key={node.id}
                    className="flex items-start gap-3 rounded-lg bg-muted/40 p-4"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-xs font-medium tabular-nums ring-1 ring-border">
                      {index + 1}
                    </span>
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        accentChipClass(def.accent)
                      )}
                    >
                      <NodeIcon name={def.icon} className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {label}
                      </p>
                      <p className="text-xs text-pretty text-muted-foreground">
                        {summarise(node.data.nodeType, values)}
                      </p>
                      {stray ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Not connected yet — draw a line into this step.
                        </p>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}

          <p className="mt-6 text-xs text-pretty text-muted-foreground">
            RaketShip does not run these flows yet. This preview is here so you
            can check the order reads the way you mean it.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

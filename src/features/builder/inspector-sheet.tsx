"use client"

import { useId, useState, useTransition } from "react"
import Link from "next/link"
import { Lock, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import type { CanvasNode } from "@/lib/flow/mappers"
import { resolveNodeType, type FieldDef, type NodeTypeDef } from "@/lib/flow/registry"
import { cn } from "@/lib/utils"

import { deleteNode, updateNodeData } from "@/features/builder/actions"
import { NodeIcon, accentChipClass } from "@/features/builder/element-node"
import { sheetSideClass, useSheetSide } from "@/features/builder/use-is-desktop"

export interface InspectorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  flowId: string
  node: CanvasNode | null
  moduleId?: string
  onSaved: (nodeKey: string, values: Record<string, unknown>) => void
  onDeleted: (nodeKey: string) => void
}

/** The trigger and the structural nodes hold the flow together. */
function canDelete(def: NodeTypeDef): boolean {
  if (def.type === "start" || def.type === "module") return false
  return !(def.category === "trigger" && def.maxPerFlow === 1)
}

function asText(value: unknown): string {
  if (value === undefined || value === null) return ""
  return String(value)
}

function coerce(
  fields: readonly FieldDef[],
  draft: Record<string, string>
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of fields) {
    const raw = draft[field.key] ?? ""
    if (field.type === "number") {
      // An emptied box means "leave it alone", not zero.
      const trimmed = raw.trim()
      if (trimmed === "") continue
      const parsed = Number(trimmed)
      if (Number.isFinite(parsed)) values[field.key] = parsed
      continue
    }
    values[field.key] = raw
  }
  return values
}

function Field({
  field,
  value,
  disabled,
  onChange,
}: {
  field: FieldDef
  value: string
  disabled: boolean
  onChange: (next: string) => void
}) {
  const id = useId()

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{field.label}</Label>

      {field.type === "textarea" ? (
        <Textarea
          id={id}
          rows={field.rows ?? 3}
          placeholder={field.placeholder}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}

      {field.type === "text" ? (
        <Input
          id={id}
          placeholder={field.placeholder}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-11"
        />
      ) : null}

      {field.type === "number" ? (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={field.min}
            max={field.max}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className="h-11"
          />
          {field.suffix ? (
            <span className="shrink-0 text-sm text-muted-foreground">
              {field.suffix}
            </span>
          ) : null}
        </div>
      ) : null}

      {field.type === "select" ? (
        <Select
          value={value}
          disabled={disabled}
          items={field.options.map((option) => ({
            label: option.label,
            value: option.value,
          }))}
          onValueChange={(next) => onChange(next ?? "")}
        >
          <SelectTrigger id={id} className="h-11! w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {field.help ? (
        <p className="max-w-prose text-xs text-pretty text-muted-foreground">
          {field.help}
        </p>
      ) : null}
    </div>
  )
}

function InspectorForm({
  flowId,
  node,
  moduleId,
  onSaved,
  onDeleted,
  onOpenChange,
}: {
  flowId: string
  node: CanvasNode
  moduleId?: string
  onSaved: (nodeKey: string, values: Record<string, unknown>) => void
  onDeleted: (nodeKey: string) => void
  onOpenChange: (open: boolean) => void
}) {
  const def = resolveNodeType(node.data.nodeType)
  const locked = node.data.locked
  const upgradeId = def.moduleId ?? moduleId
  const upgradeHref = upgradeId ? `/marketplace/${upgradeId}` : "/marketplace"
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const field of def.fields) {
      initial[field.key] = asText(node.data.values[field.key])
    }
    return initial
  })
  const [confirming, setConfirming] = useState(false)
  const [saving, startSaving] = useTransition()
  const [removing, startRemoving] = useTransition()

  function save() {
    const values = coerce(def.fields, draft)
    startSaving(async () => {
      try {
        const result = await updateNodeData({
          flowId,
          nodeKey: node.id,
          values,
        })
        if (!result.ok) {
          toast.error(result.message ?? "We could not save that.")
          return
        }
        onSaved(node.id, values)
        onOpenChange(false)
        toast.success("Saved. Salamat!")
      } catch {
        toast.error("Something went wrong. Please try again.")
      }
    })
  }

  function remove() {
    startRemoving(async () => {
      try {
        const result = await deleteNode({ flowId, nodeKey: node.id })
        if (!result.ok) {
          toast.error(result.message ?? "We could not remove that step.")
          return
        }
        onDeleted(node.id)
        onOpenChange(false)
        toast.success("Step removed.")
      } catch {
        toast.error("Something went wrong. Please try again.")
      }
    })
  }

  return (
    <>
      {/* `flex-1` earns its keep on the desktop side panel: the popup is
          full height there, so the fields take the slack and the buttons stay
          at the foot of the rail instead of floating mid-air. */}
      <div className="no-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-2">
        {locked ? (
          <div className="flex items-start gap-3 rounded-lg bg-muted p-4">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">This step is locked</p>
              <p className="max-w-prose text-xs text-pretty text-muted-foreground">
                It came with a tier you are not on right now. Upgrade to edit it
                again.
              </p>
              <Link
                href={upgradeHref}
                className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                See the tiers
              </Link>
            </div>
          </div>
        ) : null}

        <div className="space-y-3 lg:space-y-4">
          {def.fields.map((field) => (
            <Field
              key={field.key}
              field={field}
              value={draft[field.key] ?? ""}
              disabled={locked || saving || removing}
              onChange={(next) =>
                setDraft((current) => ({ ...current, [field.key]: next }))
              }
            />
          ))}
        </div>
      </div>

      {/* `pb-safe` belongs on the popup, not here: it is a later rule in the
          same utilities layer and would silently cancel `pb-6`. */}
      <div className="shrink-0 space-y-3 px-4 pb-6 lg:border-t lg:border-border lg:pt-4">
        <Button
          className="h-11 w-full"
          onClick={save}
          disabled={locked || saving}
        >
          {saving ? "Saving…" : "Save"}
        </Button>

        {canDelete(def) ? (
          <Button
            variant="destructive"
            className={cn("h-11 w-full", removing && "opacity-70")}
            disabled={removing}
            onClick={() => {
              if (!confirming) {
                setConfirming(true)
                return
              }
              remove()
            }}
          >
            <Trash2 />
            {confirming ? "Tap again to delete" : "Delete step"}
          </Button>
        ) : null}
      </div>
    </>
  )
}

export function InspectorSheet({
  open,
  onOpenChange,
  flowId,
  node,
  moduleId,
  onSaved,
  onDeleted,
}: InspectorSheetProps) {
  const side = useSheetSide()
  const def = node ? resolveNodeType(node.data.nodeType) : null

  return (
    <Sheet open={open} onOpenChange={(next) => onOpenChange(next)}>
      <SheetContent side={side} className={sheetSideClass(side)}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 lg:text-lg">
            {def ? (
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg lg:size-10",
                  accentChipClass(def.accent)
                )}
              >
                <NodeIcon name={def.icon} className="size-4 lg:size-5" />
              </span>
            ) : null}
            {def?.label ?? "Step"}
          </SheetTitle>
          <SheetDescription className="max-w-prose text-pretty">
            {def?.description ?? "Pick a step on the canvas to edit it."}
          </SheetDescription>
        </SheetHeader>

        {node ? (
          <InspectorForm
            key={node.id}
            flowId={flowId}
            node={node}
            moduleId={moduleId}
            onSaved={onSaved}
            onDeleted={onDeleted}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

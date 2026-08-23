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
      const parsed = Number(raw.trim())
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
        <p className="text-xs text-pretty text-muted-foreground">{field.help}</p>
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
      <div className="no-scrollbar space-y-6 overflow-y-auto px-4 pb-2">
        {locked ? (
          <div className="flex items-start gap-3 rounded-lg bg-muted p-4">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">This step is locked</p>
              <p className="text-xs text-pretty text-muted-foreground">
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

        <div className="space-y-3">
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

      <div className="space-y-3 px-4 pb-6 pb-safe">
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
  const def = node ? resolveNodeType(node.data.nodeType) : null

  return (
    <Sheet open={open} onOpenChange={(next) => onOpenChange(next)}>
      <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {def ? (
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg",
                  accentChipClass(def.accent)
                )}
              >
                <NodeIcon name={def.icon} className="size-4" />
              </span>
            ) : null}
            {def?.label ?? "Step"}
          </SheetTitle>
          <SheetDescription>
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

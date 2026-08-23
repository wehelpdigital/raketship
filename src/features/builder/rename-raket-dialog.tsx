"use client"

import { useState, useTransition } from "react"
import { PencilLine } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { renameRaket } from "@/features/builder/actions"

export function RenameRaketDialog({
  raketId,
  name,
}: {
  raketId: string
  name: string
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(name)
  const [saving, startSaving] = useTransition()

  function save() {
    startSaving(async () => {
      try {
        const result = await renameRaket({ raketId, name: value })
        if (!result.ok) {
          toast.error(result.message ?? "We could not rename that raket.")
          return
        }
        setOpen(false)
        toast.success("Renamed. Salamat!")
      } catch {
        toast.error("Something went wrong. Please try again.")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setValue(name)
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="size-11 shrink-0 p-0"
            aria-label="Rename this raket"
          />
        }
      >
        <PencilLine />
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Name your raket</DialogTitle>
          <DialogDescription>
            This is what you will see on your dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="raket-name">Raket name</Label>
          <Input
            id="raket-name"
            value={value}
            maxLength={60}
            disabled={saving}
            onChange={(event) => setValue(event.target.value)}
            className="h-11"
          />
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-11" />}>
            Cancel
          </DialogClose>
          <Button className="h-11" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save name"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

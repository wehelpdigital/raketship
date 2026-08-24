"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CalendarPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { CalendarForm } from "@/features/booking/calendar-form"
import { cn } from "@/lib/utils"

export interface NewCalendarDialogProps {
  label?: string
  variant?: "default" | "outline" | "secondary"
  /** Full width on the empty state, auto width in the page header. */
  className?: string
}

/**
 * "New calendar" from both the page header and the empty state.
 *
 * A dialog rather than its own route: creating one asks five short questions,
 * and sending someone to a separate page for that loses the list they were
 * looking at. On success we go straight to the editor, because a calendar with
 * no hours yet is not finished.
 */
export function NewCalendarDialog({
  label = "New calendar",
  variant = "default",
  className,
}: NewCalendarDialogProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={variant}
            className={cn("h-11 gap-2", className)}
          />
        }
      >
        <CalendarPlus aria-hidden="true" />
        {label}
      </DialogTrigger>

      {/* Taller than the default popup and scrollable, so the three selects at
          the bottom stay reachable on a short phone in landscape. */}
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New booking calendar</DialogTitle>
          <DialogDescription>
            One calendar per thing you take bookings for. You can change all of
            this later.
          </DialogDescription>
        </DialogHeader>

        <CalendarForm
          mode="create"
          onCancel={() => setOpen(false)}
          onSuccess={(id) => {
            setOpen(false)
            if (id) router.push(`/modules/booking/${id}`)
            else router.refresh()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

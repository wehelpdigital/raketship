"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BellRing, MailCheck } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { updateCalendar } from "@/features/booking/actions"
import type { BookingCalendarRow } from "@/lib/supabase/types"

/**
 * The calendar's email switches.
 *
 * Two, not a config tree: the confirmation that goes out when a booking
 * lands, and the reminder that goes out before the appointment. Each switch
 * saves the moment it is flipped — a Save button under two toggles is a form
 * pretending to be bigger than it is — and flips back if the save fails, so
 * the screen never claims a setting the database does not hold.
 */
export function EmailsPanel({ calendar }: { calendar: BookingCalendarRow }) {
  return (
    <Card>
      <CardContent className="divide-y py-2 lg:py-3">
        <EmailToggle
          calendarId={calendar.id}
          field="sendConfirmationEmail"
          icon={MailCheck}
          title="Confirmation email"
          description="Padadalhan ang suki pagkatapos nilang mag-book — ang oras, ang lugar, at ang reference number nila."
          // ?? true: a row from before the migration reads as the default,
          // never as "off".
          initial={calendar.send_confirmation_email ?? true}
        />
        <EmailToggle
          calendarId={calendar.id}
          field="sendReminderEmail"
          icon={BellRing}
          title="Reminder email"
          description="Padadalhan ang suki bago dumating ang appointment nila, para hindi malimutan."
          initial={calendar.send_reminder_email ?? true}
        />
      </CardContent>
    </Card>
  )
}

function EmailToggle({
  calendarId,
  field,
  icon: Icon,
  title,
  description,
  initial,
}: {
  calendarId: string
  field: "sendConfirmationEmail" | "sendReminderEmail"
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>
  title: string
  description: string
  initial: boolean
}) {
  const router = useRouter()
  const [on, setOn] = React.useState(initial)
  const [busy, startBusy] = React.useTransition()
  const id = React.useId()

  function flip(next: boolean) {
    setOn(next)
    startBusy(async () => {
      try {
        const result = await updateCalendar({ calendarId, [field]: next })
        if (!result.ok) {
          setOn(!next)
          toast.error(result.message ?? "Hindi na-save. Pakisubukan ulit.")
          return
        }
        router.refresh()
      } catch {
        setOn(!next)
        toast.error("Something went wrong. Pakisubukan ulit.")
      }
    })
  }

  return (
    <div className="flex items-center gap-3 py-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>

      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer select-none">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-pretty text-muted-foreground">
          {description}
        </span>
      </label>

      <Switch
        id={id}
        checked={on}
        disabled={busy}
        onCheckedChange={(next) => flip(Boolean(next))}
        aria-label={title}
      />
    </div>
  )
}

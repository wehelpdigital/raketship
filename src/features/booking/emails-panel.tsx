"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Collapsible } from "@base-ui/react/collapsible"
import { BellRing, MailCheck } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { updateCalendar } from "@/features/booking/actions"
import type { BookingCalendarRow } from "@/lib/supabase/types"

/**
 * The reminder times on offer — a fixed menu, not a picker.
 *
 * Reminders come at the times reminders come: the day before, the same
 * shift, and just before. A free hours-and-minutes picker put the owner in
 * charge of a number nobody plans in numbers; three switches cannot be held
 * wrong.
 */
const REMINDER_TIMES = [
  {
    field: "reminder24h",
    column: "reminder_24h",
    label: "24 hours before",
    description: "Isang araw bago — panahong mag-ayos o magpaalam.",
    fallback: true,
  },
  {
    field: "reminder8h",
    column: "reminder_8h",
    label: "8 hours before",
    description: "Sa umaga ng appointment.",
    fallback: false,
  },
  {
    field: "reminder15m",
    column: "reminder_15m",
    label: "15 minutes before",
    description: "Paalala na malapit na — papunta na dapat.",
    fallback: false,
  },
] as const

/**
 * The calendar's email switches.
 *
 * Two, not a config tree: the confirmation that goes out when a booking
 * lands, and the reminder that goes out before the appointment. Each switch
 * saves the moment it is flipped — a Save button under a stack of toggles is
 * a form pretending to be bigger than it is — and flips back if the save
 * fails, so the screen never claims a setting the database does not hold.
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
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Kailan ipapadala
            </p>
            {REMINDER_TIMES.map((time) => (
              <ReminderTime
                key={time.field}
                calendarId={calendar.id}
                field={time.field}
                label={time.label}
                description={time.description}
                initial={calendar[time.column] ?? time.fallback}
              />
            ))}
          </div>
        </EmailToggle>
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
  children,
}: {
  calendarId: string
  field: "sendConfirmationEmail" | "sendReminderEmail"
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>
  title: string
  description: string
  initial: boolean
  /** Settings that only mean anything while the switch is on. */
  children?: React.ReactNode
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
    <div className="py-3.5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>

        <label
          htmlFor={id}
          className="min-w-0 flex-1 cursor-pointer select-none"
        >
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

      {children ? (
        /*
          Folded away with the switch rather than removed: a setting that
          vanishes the moment its switch goes off reads as data loss, and the
          height animating shut says "asleep", not "gone".
        */
        <Collapsible.Root open={on}>
          <Collapsible.Panel
            keepMounted
            className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none"
          >
            {/* Indented to the label, so it reads as the toggle's detail. */}
            <div className="pt-3 pl-12">{children}</div>
          </Collapsible.Panel>
        </Collapsible.Root>
      ) : null}
    </div>
  )
}

/** One of the fixed reminder times, with its own switch. */
function ReminderTime({
  calendarId,
  field,
  label,
  description,
  initial,
}: {
  calendarId: string
  field: "reminder24h" | "reminder8h" | "reminder15m"
  label: string
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
    <div className="flex items-center gap-3 py-2">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer select-none">
        <span className="block text-sm">{label}</span>
        <span className="block text-xs text-pretty text-muted-foreground">
          {description}
        </span>
      </label>
      <Switch
        id={id}
        checked={on}
        disabled={busy}
        onCheckedChange={(next) => flip(Boolean(next))}
        aria-label={label}
      />
    </div>
  )
}

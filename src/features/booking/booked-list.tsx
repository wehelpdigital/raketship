"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CalendarX2,
  Loader2,
  Mail,
  Phone,
  RotateCcw,
  Undo2,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cancelBooking, restoreBooking } from "@/features/booking/actions"
import { answerToText, type AnswerValue } from "@/lib/booking/fields"
import { longDate } from "@/lib/booking/dates"
import { formatDuration, instantInZone } from "@/lib/booking/slots"
import type { BookingFormFieldRow } from "@/lib/supabase/types"
import { cn, formatPeso } from "@/lib/utils"

/** Only what the list renders — the rows themselves stay on the server. */
export interface BookedRow {
  id: string
  calendarId: string
  calendarName: string
  /** The calendar's own zone. Every time below is read in it. */
  timezone: string
  startsAt: string
  endsAt: string
  status: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  serviceName: string | null
  servicePriceCentavos: number | null
  durationMinutes: number
  answers: Record<string, AnswerValue>
  createdAt: string
}

export interface BookedListProps {
  rows: BookedRow[]
  fieldsByCalendar: Record<string, BookingFormFieldRow[]>
  /** Cancelled rows offer to be put back instead of cancelled. */
  variant?: "active" | "cancelled"
}

/**
 * The bookings a raketero actually has, one card each.
 *
 * Times are read in the CALENDAR's zone, not the browser's. The owner runs
 * their day in their own shop's clock, and a list that quietly re-times itself
 * because they opened it while travelling would be worse than useless.
 */
export function BookedList({
  rows,
  fieldsByCalendar,
  variant = "active",
}: BookedListProps) {
  if (rows.length === 0) return null

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id}>
          <BookedCard
            row={row}
            fields={fieldsByCalendar[row.calendarId] ?? []}
            variant={variant}
          />
        </li>
      ))}
    </ul>
  )
}

function BookedCard({
  row,
  fields,
  variant,
}: {
  row: BookedRow
  fields: BookingFormFieldRow[]
  variant: "active" | "cancelled"
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [busy, startBusy] = React.useTransition()

  const when = instantInZone(row.startsAt, row.timezone)
  const until = instantInZone(row.endsAt, row.timezone)
  const cancelled = variant === "cancelled"

  // Only questions this calendar asked, and only ones actually answered.
  const answered = fields
    .map((field) => ({ field, text: answerToText(row.answers[field.id] ?? null) }))
    .filter((entry) => entry.text.length > 0)

  function act(run: () => Promise<{ ok: boolean; message?: string }>) {
    startBusy(async () => {
      try {
        const result = await run()
        if (!result.ok) {
          toast.error(result.message ?? "Hindi natuloy. Pakisubukan ulit.")
          return
        }
        setOpen(false)
        toast.success(result.message ?? "Tapos na.")
        router.refresh()
      } catch {
        toast.error("Something went wrong. Pakisubukan ulit.")
      }
    })
  }

  return (
    <article
      className={cn(
        "rounded-xl bg-card p-4 ring-1 transition-colors sm:p-5",
        cancelled ? "ring-border/60 opacity-75" : "ring-border"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 space-y-0.5">
          {/* The time first and largest: it is the thing the owner is scanning
              for, and everything else is detail hanging off it. */}
          <p className="text-base font-semibold tracking-tight tabular-nums">
            {when.time}
            <span className="text-muted-foreground"> – {until.time}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {longDate(when.isoDate)}
          </p>
        </div>

        <Badge variant={cancelled ? "outline" : "default"} className="shrink-0">
          {cancelled ? "Cancelled" : "Booked"}
        </Badge>
      </div>

      <div className="mt-3 space-y-2 border-t pt-3">
        <p className="text-sm font-medium text-pretty">{row.customerName}</p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {row.customerEmail ? (
            <a
              href={`mailto:${row.customerEmail}`}
              className="inline-flex min-w-0 items-center gap-1.5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Mail className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{row.customerEmail}</span>
            </a>
          ) : null}
          {row.customerPhone ? (
            <a
              href={`tel:${row.customerPhone}`}
              className="inline-flex items-center gap-1.5 tabular-nums hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Phone className="size-3.5 shrink-0" aria-hidden="true" />
              {row.customerPhone}
            </a>
          ) : null}
        </div>

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{row.calendarName}</span>
          {row.serviceName ? (
            <>
              <span aria-hidden="true">·</span>
              {/* The snapshot taken at booking time, not today's price list —
                  this is what the customer actually agreed to. */}
              <span>{row.serviceName}</span>
            </>
          ) : null}
          {row.servicePriceCentavos ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {formatPeso(row.servicePriceCentavos)}
              </span>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <span>{formatDuration(row.durationMinutes)}</span>
        </p>

        {answered.length > 0 ? (
          <dl className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
            {answered.map(({ field, text }) => (
              <div key={field.id} className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">{field.label}:</dt>
                <dd className="min-w-0 text-pretty">{text}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      <div className="mt-3 flex justify-end">
        {cancelled ? (
          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2"
            disabled={busy}
            onClick={() => act(() => restoreBooking(row.id))}
          >
            {busy ? (
              <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <Undo2 className="size-4" aria-hidden="true" />
            )}
            Ibalik
          </Button>
        ) : (
          <Dialog open={open} onOpenChange={setOpen}>
            <Button
              type="button"
              variant="ghost"
              className="h-10 gap-2 text-muted-foreground hover:text-destructive"
              disabled={busy}
              onClick={() => setOpen(true)}
            >
              <CalendarX2 className="size-4" aria-hidden="true" />
              I-cancel
            </Button>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>I-cancel ang booking?</DialogTitle>
                <DialogDescription className="text-pretty">
                  {`${row.customerName}, ${longDate(when.isoDate)} ${when.time}. `}
                  Babalik sa bakante ang oras na ito, kaya pwede na ulit itong
                  kunin ng iba. Hindi namin sila aabisuhan — ikaw ang
                  magpapaalam.
                </DialogDescription>
              </DialogHeader>

              <DialogFooter>
                <DialogClose render={<Button variant="outline" className="h-11" />}>
                  Huwag muna
                </DialogClose>
                <Button
                  variant="destructive"
                  className="h-11 gap-2"
                  disabled={busy}
                  onClick={() => act(() => cancelBooking(row.id))}
                >
                  {busy ? (
                    <Loader2
                      className="size-4 motion-safe:animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <RotateCcw className="size-4" aria-hidden="true" />
                  )}
                  Oo, i-cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </article>
  )
}

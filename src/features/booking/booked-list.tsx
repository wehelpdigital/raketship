"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CalendarX2,
  ChevronDown,
  Loader2,
  RotateCcw,
  Undo2,
} from "lucide-react"
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
} from "@/components/ui/dialog"
import { cancelBooking, restoreBooking } from "@/features/booking/actions"
import { referenceOf } from "@/lib/booking/booked-filter"
import { longDate } from "@/lib/booking/dates"
import { answerToText, type AnswerValue } from "@/lib/booking/fields"
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

export interface BookedRowCardProps {
  row: BookedRow
  fields: BookingFormFieldRow[]
  variant: "active" | "cancelled"
  /**
   * Whether the row has to name its calendar.
   *
   * With one calendar it is the same word on every row; with several it is the
   * only thing telling two identical-looking bookings apart.
   */
  showCalendar?: boolean
  open: boolean
  onToggle: () => void
}

/**
 * One booking, closed to a line and opened to everything.
 *
 * Closed it is a scannable row: when, who, and what — which is what an owner
 * reads down the page looking for one particular booking. Opened it gives the
 * contact details, the answers to their own form questions, and the way to
 * cancel.
 *
 * Times are read in the CALENDAR's zone, never the browser's. The owner runs
 * their day on their own shop's clock, and a list that quietly re-timed itself
 * because they opened it while travelling would be worse than useless.
 */
export function BookedRowCard({
  row,
  fields,
  variant,
  showCalendar = false,
  open,
  onToggle,
}: BookedRowCardProps) {
  const router = useRouter()
  const [confirming, setConfirming] = React.useState(false)
  const [busy, startBusy] = React.useTransition()
  const bodyId = React.useId()

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
        setConfirming(false)
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
        "overflow-hidden rounded-xl bg-card ring-1 transition-colors",
        open ? "ring-primary/30" : "ring-border hover:ring-ring/40",
        cancelled && "opacity-75"
      )}
    >
      {/* The whole row is the control. One large target beats a chevron the
          size of a fingernail, which is what this is on a phone. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:gap-4 sm:px-5"
      >
        {/*
          Fixed width so the times line up down the page and the eye can run
          along one column instead of tracking ragged text. The DAY is on the
          heading above this row, so all a row has to say is when in the day.
        */}
        <span className="w-[4.5rem] shrink-0 sm:w-24">
          <span className="block text-sm font-semibold tabular-nums">
            {when.time}
          </span>
          <span className="block text-xs text-muted-foreground tabular-nums">
            {`– ${until.time}`}
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {row.customerName}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {row.serviceName ?? row.calendarName}
            {showCalendar && row.serviceName ? ` · ${row.calendarName}` : ""}
          </span>
        </span>

        {/* Dropped on the narrowest phones, where the name has to win. */}
        <span className="hidden shrink-0 text-right sm:block">
          {row.servicePriceCentavos ? (
            <span className="block text-sm font-medium tabular-nums">
              {formatPeso(row.servicePriceCentavos)}
            </span>
          ) : null}
          <span className="block text-xs text-muted-foreground tabular-nums">
            {formatDuration(row.durationMinutes)}
          </span>
        </span>

        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div id={bodyId} className="space-y-4 border-t px-4 py-4 sm:px-5">
          {/*
            Written out as "Label: value" rather than a grid of headings above
            values. An owner reading a booking back to a customer on the phone
            reads a line, not a layout — and half of these are one short word,
            which a heading above makes taller than the thing it names.
          */}
          {/*
            One column on a phone, two once there is room. A single column of
            eleven short lines down a 900px screen is mostly empty space, and
            the eye has to travel further than the facts are worth.
          */}
          <dl className="grid gap-x-8 gap-y-1.5 text-sm lg:grid-cols-2">
            <Fact label="Pangalan">{row.customerName}</Fact>

            <Fact label="Kailan">
              <span className="tabular-nums">
                {longDate(when.isoDate)}, {when.time} – {until.time}
              </span>
            </Fact>

            <Fact label="Timezone">{row.timezone}</Fact>

            {row.customerEmail ? (
              <Fact label="Email">
                <a
                  href={`mailto:${row.customerEmail}`}
                  className="underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {row.customerEmail}
                </a>
              </Fact>
            ) : null}

            {row.customerPhone ? (
              <Fact label="Mobile">
                <a
                  href={`tel:${row.customerPhone}`}
                  className="tabular-nums underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {row.customerPhone}
                </a>
              </Fact>
            ) : null}

            {!row.customerEmail && !row.customerPhone ? (
              <Fact label="Contact">
                <span className="text-muted-foreground">Wala silang iniwan</span>
              </Fact>
            ) : null}

            <Fact label="Serbisyo">{row.serviceName ?? row.calendarName}</Fact>

            <Fact label="Haba">{formatDuration(row.durationMinutes)}</Fact>

            {row.servicePriceCentavos ? (
              <Fact label="Presyo">
                <span className="tabular-nums">
                  {formatPeso(row.servicePriceCentavos)}
                </span>
              </Fact>
            ) : null}

            <Fact label="Calendar">{row.calendarName}</Fact>

            <Fact label="Reference">
              <span className="font-mono tracking-wider tabular-nums">
                {referenceOf(row.id)}
              </span>
            </Fact>
          </dl>

          {answered.length > 0 ? (
            <div className="rounded-lg bg-muted/40 p-3">
              {/* Said out loud, so these are not mistaken for booking fields
                  the app invented. They are the owner's own questions. */}
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Sagot sa form mo
              </p>
              <dl className="space-y-1.5 text-sm">
                {answered.map(({ field, text }) => (
                  <Fact key={field.id} label={field.label}>
                    {text}
                  </Fact>
                ))}
              </dl>
            </div>
          ) : null}

          <div className="flex justify-end">
            {cancelled ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-2"
                disabled={busy}
                onClick={() => act(() => restoreBooking(row.id))}
              >
                {busy ? (
                  <Loader2
                    className="size-4 motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Undo2 className="size-4" aria-hidden="true" />
                )}
                Ibalik
              </Button>
            ) : (
              <Dialog open={confirming} onOpenChange={setConfirming}>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 gap-2 text-muted-foreground hover:text-destructive"
                  disabled={busy}
                  onClick={() => setConfirming(true)}
                >
                  <CalendarX2 className="size-4" aria-hidden="true" />
                  I-cancel
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>I-cancel ang booking?</DialogTitle>
                    <DialogDescription className="text-pretty">
                      {`${row.customerName}, ${longDate(when.isoDate)} ${when.time}. `}
                      Babalik sa bakante ang oras na ito, kaya pwede na ulit
                      itong kunin ng iba. Hindi namin sila aabisuhan — ikaw ang
                      magpapaalam.
                    </DialogDescription>
                  </DialogHeader>

                  <DialogFooter>
                    <DialogClose
                      render={<Button variant="outline" className="h-11" />}
                    >
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
        </div>
      ) : null}
    </article>
  )
}

/**
 * One labelled fact, on one line: "Pangalan: Gero Santos".
 *
 * The label keeps a fixed width on anything wider than a phone so the values
 * line up in a column and the whole panel can be read down rather than across.
 * Below that it wraps, because a fixed label column at 390px leaves the value
 * a few characters wide.
 */
function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-muted-foreground sm:w-24 sm:shrink-0">{label}:</dt>
      <dd className="min-w-0 flex-1 text-pretty">{children}</dd>
    </div>
  )
}

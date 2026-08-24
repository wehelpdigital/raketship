"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CalendarX2,
  ChevronDown,
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
          Fixed-width on desktop so the times line up down the page and the eye
          can run along one column instead of tracking ragged text.
        */}
        <span className="w-20 shrink-0 sm:w-28">
          <span className="block text-sm font-semibold tabular-nums">
            {when.time}
          </span>
          <span className="block text-xs text-muted-foreground tabular-nums">
            {when.isoDate}
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {row.customerName}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {row.calendarName}
            {row.serviceName ? ` · ${row.serviceName}` : ""}
          </span>
        </span>

        {/* The detail that only fits once there is room for it. */}
        <span className="hidden w-32 shrink-0 text-right lg:block">
          <span className="block text-xs text-muted-foreground tabular-nums">
            {formatDuration(row.durationMinutes)}
          </span>
          {row.servicePriceCentavos ? (
            <span className="block text-xs font-medium tabular-nums">
              {formatPeso(row.servicePriceCentavos)}
            </span>
          ) : null}
        </span>

        <Badge
          variant={cancelled ? "outline" : "default"}
          className="hidden shrink-0 sm:inline-flex"
        >
          {cancelled ? "Cancelled" : "Booked"}
        </Badge>

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
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Fact label="Kailan">
              <span className="tabular-nums">
                {longDate(when.isoDate)}, {when.time} – {until.time}
              </span>
              <span className="block text-xs text-muted-foreground">
                {row.timezone}
              </span>
            </Fact>

            <Fact label="Reference">
              <span className="font-mono tracking-wider tabular-nums">
                {referenceOf(row.id)}
              </span>
            </Fact>

            <Fact label="Contact">
              {row.customerEmail ? (
                <a
                  href={`mailto:${row.customerEmail}`}
                  className="flex min-w-0 items-center gap-1.5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{row.customerEmail}</span>
                </a>
              ) : null}
              {row.customerPhone ? (
                <a
                  href={`tel:${row.customerPhone}`}
                  className="flex items-center gap-1.5 tabular-nums hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                  {row.customerPhone}
                </a>
              ) : null}
              {!row.customerEmail && !row.customerPhone ? (
                <span className="text-muted-foreground">Wala silang iniwan</span>
              ) : null}
            </Fact>

            <Fact label="Serbisyo">
              {row.serviceName ?? row.calendarName}
              <span className="block text-xs text-muted-foreground">
                {formatDuration(row.durationMinutes)}
                {row.servicePriceCentavos
                  ? ` · ${formatPeso(row.servicePriceCentavos)}`
                  : ""}
              </span>
            </Fact>
          </dl>

          {answered.length > 0 ? (
            <dl className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-sm">
              {answered.map(({ field, text }) => (
                <div key={field.id} className="flex flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">{field.label}:</dt>
                  <dd className="min-w-0 text-pretty">{text}</dd>
                </div>
              ))}
            </dl>
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

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 space-y-0.5 text-pretty">{children}</dd>
    </div>
  )
}

"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Collapsible } from "@base-ui/react/collapsible"
import { CalendarX2, ChevronDown, Loader2, RotateCcw, Undo2 } from "lucide-react"
import { toast } from "sonner"

import { useT } from "@/components/shell/locale-provider"
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
 * Closed it is ONE line: when, who, and what — which is what an owner reads
 * down the page looking for one particular booking. Opened it gives the
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
  const t = useT()
  const router = useRouter()
  const [confirming, setConfirming] = React.useState(false)
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
          toast.error(result.message ?? t("booked.toast.failed"))
          return
        }
        setConfirming(false)
        toast.success(result.message ?? t("booked.toast.done"))
        router.refresh()
      } catch {
        toast.error(t("booked.toast.error"))
      }
    })
  }

  /*
    A row, not a card. The day it belongs to owns the card and the hairlines
    between its rows, so a row here paints nothing of its own except the
    shading that says it is the one that is open.
  */
  return (
    <Collapsible.Root
      open={open}
      onOpenChange={onToggle}
      render={
        <article
          className={cn(
            "transition-colors",
            open && "bg-muted/40",
            cancelled && "opacity-75"
          )}
        />
      }
    >
      {/* The whole row is the control. One large target beats a chevron the
          size of a fingernail, which is what this is on a phone. */}
      <Collapsible.Trigger className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:gap-4 sm:px-5">
        {/*
          The whole range on ONE line, at a fixed width so the times line up
          down the page and the eye can run along one column instead of
          tracking ragged text. The DAY is on the heading above this row.

          One piece, one style: "10:30 AM – 11:00 AM" is a single fact, and
          splitting its styling down the middle made it read as two.
        */}
        <span className="w-[9.5rem] shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums">
          {when.time} – {until.time}
        </span>

        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium">{row.customerName}</span>
          {row.serviceName ? (
            <span className="text-muted-foreground">{` · ${row.serviceName}`}</span>
          ) : null}
        </span>

        {/*
          The calendar is DIFFERENT information from who booked — it is where
          the booking landed — so it keeps its own column on the right instead
          of hanging off the name.
        */}
        <span className="min-w-0 max-w-[38%] shrink truncate text-right text-sm text-muted-foreground">
          {row.calendarName}
        </span>

        {/* Dropped on the narrowest phones, where the name has to win. */}
        <span className="hidden shrink-0 text-right text-xs whitespace-nowrap sm:block">
          {row.servicePriceCentavos ? (
            <span className="font-medium tabular-nums">
              {formatPeso(row.servicePriceCentavos)}
              <span className="text-muted-foreground"> · </span>
            </span>
          ) : null}
          <span className="text-muted-foreground tabular-nums">
            {formatDuration(row.durationMinutes)}
          </span>
        </span>

        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </Collapsible.Trigger>

      {/*
        Base UI measures the panel and hands its height over as a CSS variable,
        so the open and close can both be animated without this component
        having to know anything about its own contents — and it animates CLOSED
        as well as open, which a panel that only exists while it is open cannot.
      */}
      <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
        <div className="space-y-4 border-t px-4 pt-4 pb-5 sm:px-5">
          {/*
            Written out as "Label: value" rather than a grid of headings above
            values. An owner reading a booking back to a customer on the phone
            reads a line, not a layout — and half of these are one short word,
            which a heading above makes taller than the thing it names.

            One column on a phone, two once there is room.
          */}
          <dl className="grid gap-x-8 gap-y-1.5 text-sm lg:grid-cols-2">
            <Fact label={t("booked.fact.name")}>{row.customerName}</Fact>

            <Fact label={t("booked.fact.when")}>
              <span className="tabular-nums">
                {longDate(when.isoDate)}, {when.time} – {until.time}
              </span>
            </Fact>

            <Fact label={t("booked.fact.timezone")}>{row.timezone}</Fact>

            {row.customerEmail ? (
              <Fact label={t("booked.fact.email")}>
                <a
                  href={`mailto:${row.customerEmail}`}
                  className="underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {row.customerEmail}
                </a>
              </Fact>
            ) : null}

            {row.customerPhone ? (
              <Fact label={t("booked.fact.mobile")}>
                <a
                  href={`tel:${row.customerPhone}`}
                  className="tabular-nums underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {row.customerPhone}
                </a>
              </Fact>
            ) : null}

            {!row.customerEmail && !row.customerPhone ? (
              <Fact label={t("booked.fact.contact")}>
                <span className="text-muted-foreground">
                  {t("booked.fact.noContact")}
                </span>
              </Fact>
            ) : null}

            <Fact label={t("booked.fact.service")}>
              {row.serviceName ?? row.calendarName}
            </Fact>

            <Fact label={t("booked.fact.length")}>
              {formatDuration(row.durationMinutes)}
            </Fact>

            {row.servicePriceCentavos ? (
              <Fact label={t("booked.fact.price")}>
                <span className="tabular-nums">
                  {formatPeso(row.servicePriceCentavos)}
                </span>
              </Fact>
            ) : null}

            <Fact label={t("booked.fact.calendar")}>{row.calendarName}</Fact>

            <Fact label={t("booked.fact.reference")}>
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
                {t("booked.answers")}
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
                {t("booked.action.restore")}
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
                  {t("booked.action.cancel")}
                </Button>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("booked.cancel.title")}</DialogTitle>
                    <DialogDescription className="text-pretty">
                      {t("booked.cancel.body", {
                        who: row.customerName,
                        when: `${longDate(when.isoDate)} ${when.time}`,
                      })}
                    </DialogDescription>
                  </DialogHeader>

                  <DialogFooter>
                    <DialogClose
                      render={<Button variant="outline" className="h-11" />}
                    >
                      {t("common.cancel")}
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
                      {t("booked.cancel.confirm")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
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

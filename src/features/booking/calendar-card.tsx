"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarCheck, Check, Copy, Timer } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDuration } from "@/lib/booking/slots"
import type { BookingCalendarRow } from "@/lib/supabase/types"

export interface CalendarCardProps {
  calendar: BookingCalendarRow
  bookingCount: number
  /** How many services this calendar sells. Only read in catalogue mode. */
  serviceCount?: number
  /** Absolute public URL, built on the server so it matches on hydration. */
  publicUrl: string
}

function bookingLabel(count: number): string {
  if (count === 0) return "No bookings yet"
  return count === 1 ? "1 booking" : `${count} bookings`
}

/**
 * What to say about how long a booking runs.
 *
 * A calendar selling a catalogue has no single answer — stating the stored
 * duration_minutes there would name a length nothing is actually booked at.
 */
function lengthLabel(
  calendar: BookingCalendarRow,
  serviceCount: number | undefined
): string {
  if (calendar.length_mode === "catalog" && (serviceCount ?? 0) > 0) {
    return serviceCount === 1 ? "1 service" : `${serviceCount} services`
  }
  return `${formatDuration(calendar.duration_minutes)} per booking`
}

function Meta({
  icon: Icon,
  children,
}: {
  icon: typeof Timer
  children: React.ReactNode
}) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-pretty">{children}</span>
    </p>
  )
}

/**
 * One calendar on the module index.
 *
 * The whole card opens the editor, but a card cannot be a link with a button
 * inside it, so the title carries the navigation and stretches over the card
 * with a pseudo-element. The copy button then sits above it on its own layer.
 */
export function CalendarCard({
  calendar,
  bookingCount,
  serviceCount,
  publicUrl,
}: CalendarCardProps) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    const handle = timer
    return () => {
      if (handle.current) clearTimeout(handle.current)
    }
  }, [])

  async function copyLink() {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("clipboard unavailable")
      }
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      toast.success("Link copied. Paste it wherever your suki will see it.")
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(
        "Your browser would not let us copy. Open the link and copy it from there."
      )
    }
  }

  // Press feedback rides on `has-[a:active]` rather than `active:` because the
  // thing being pressed is the title link's stretched ::after, not the card.
  // The copy row sits at z-10 above that overlay, so pressing it never reads as
  // pressing the card.
  return (
    <article className="group relative flex h-full touch-manipulation flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-[transform,background-color,box-shadow] duration-150 ease-out hover:bg-muted/40 has-[a:active]:bg-muted/60 has-[a:active]:shadow-sm has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:active]:motion-safe:scale-[0.985] sm:p-5 lg:gap-4 lg:p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-sm font-medium text-balance lg:text-base">
          <Link
            href={`/modules/booking/${calendar.id}`}
            className="line-clamp-2 outline-none after:absolute after:inset-0 after:rounded-xl"
          >
            {calendar.name}
          </Link>
        </h3>
        <Badge variant={calendar.is_published ? "default" : "outline"}>
          {calendar.is_published ? "Published" : "Draft"}
        </Badge>
      </div>

      {calendar.description ? (
        <p className="line-clamp-2 text-sm text-pretty text-muted-foreground">
          {calendar.description}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Meta icon={Timer}>
          {lengthLabel(calendar, serviceCount)} · {calendar.timezone}
        </Meta>
        <Meta icon={CalendarCheck}>{bookingLabel(bookingCount)}</Meta>
      </div>

      {/* Pushed to the bottom so cards of different description lengths still
          line their link rows up across the grid. */}
      <div className="mt-auto pt-1">
        {calendar.is_published ? (
          <div className="relative z-10 flex items-center gap-2 rounded-lg bg-muted/60 p-1 pl-3 sm:p-1.5">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
              {publicUrl.replace(/^https?:\/\//, "")}
            </span>
            <Button
              type="button"
              variant="ghost"
              className="size-11 shrink-0 p-0 sm:size-9"
              aria-label={`Copy the link for ${calendar.name}`}
              onClick={copyLink}
            >
              {copied ? (
                <Check className="text-success" aria-hidden="true" />
              ) : (
                <Copy aria-hidden="true" />
              )}
            </Button>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-pretty text-muted-foreground">
            Not shared yet. Publish it under Share to get a link.
          </p>
        )}
      </div>
    </article>
  )
}

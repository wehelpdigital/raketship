import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  CalendarOff,
  Clock,
  Globe,
  ShieldCheck,
} from "lucide-react"
import { BookingFlow, type OpenRange } from "@/features/booking/booking-flow"
import {
  buildSlots,
  isoDateInZone,
  upcomingDates,
  zoneOffsetMinutes,
  zonedTimeToInstant,
  type SlotRules,
} from "@/lib/booking/slots"
import { bookingUrl } from "@/lib/booking/slug"
import { env } from "@/lib/env"
import { getPublishedCalendar, getTakenSlots } from "@/lib/queries/booking"
interface PageProps {
  params: Promise<{ slug: string }>
}
/** "GMT+8", or "GMT+5:30" where the zone needs the minutes. */
function gmtLabel(at: Date, timeZone: string): string {
  const offset = zoneOffsetMinutes(at, timeZone)
  const sign = offset < 0 ? "-" : "+"
  const absolute = Math.abs(offset)
  const hours = Math.floor(absolute / 60)
  const minutes = absolute % 60
  return `GMT${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`
}
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "R"
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
}
/**
 * These links travel by being pasted — into Messenger, Viber, a Facebook page
 * bio. The preview card those apps unfurl IS the first impression, so the name
 * and description are given properly rather than left to a default.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const detail = await getPublishedCalendar(slug)
  if (!detail) {
    return {
      title: "Booking link not found",
      description: "This booking link is not available.",
      robots: { index: false, follow: false },
    }
  }
  const { calendar } = detail
  const description =
    calendar.description?.trim() ||
    `Pumili ng oras para sa ${calendar.name}. ${calendar.duration_minutes} minutes bawat booking.`
  const url = bookingUrl(calendar.slug, env.siteUrl)
  const social = `Book with ${calendar.name}`
  return {
    title: calendar.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: "RaketShip",
      title: social,
      description,
    },
    twitter: {
      card: "summary",
      title: social,
      description,
    },
  }
}
export default async function PublicBookingPage({ params }: PageProps) {
  const { slug } = await params
  const detail = await getPublishedCalendar(slug)
  // getPublishedCalendar already filters on is_published; the second check is
  // here because a draft leaking onto the open web is the one failure this
  // page must not have.
  if (!detail || !detail.calendar.is_published) notFound()
  const { calendar, availability, blackouts, fields } = detail
  const now = new Date()
  const rules: SlotRules = {
    timezone: calendar.timezone,
    durationMinutes: calendar.duration_minutes,
    bufferMinutes: calendar.buffer_minutes,
    noticeHours: calendar.notice_hours,
  }
  // How far ahead this calendar accepts bookings is the owner's decision.
  // getAvailableSlots re-derives the same bound, so a hand-typed date beyond it
  // is refused rather than merely unclickable.
  const dates = upcomingDates(
    now,
    calendar.booking_horizon_days,
    calendar.timezone
  )
  const firstDate = dates[0] ?? isoDateInZone(now, calendar.timezone)
  const lastDate = dates[dates.length - 1] ?? firstDate
  // One read for the whole fortnight. Reaching back a day catches a long
  // booking made yesterday evening that still overlaps this morning.
  const taken = await getTakenSlots(
    calendar.id,
    new Date(
      zonedTimeToInstant(firstDate, 0, calendar.timezone).getTime() - 86400_000
    ).toISOString(),
    zonedTimeToInstant(lastDate, 1440, calendar.timezone).toISOString()
  )
  /*
    The server cannot know the visitor's timezone, and their day is not the
    shop's: a Manila shop's Monday is Sunday evening in New York. So instead of
    deciding which DAYS are open, it sends the open stretches as absolute
    instants and lets the browser group them by whatever zone the visitor picks.
    First and last instant per shop-day is enough to grey out the picker — it
    over-approximates across a lunch break, and the fetch on tapping a day is
    what actually decides. A handful of numbers travels; a year of slots does not.
  */
  const openRanges: OpenRange[] = dates
    .map((iso) => {
      const slots = buildSlots({
        isoDate: iso,
        rules,
        availability,
        blackouts,
        taken,
        now,
      })
      if (slots.length === 0) return null
      return {
        from: slots[0].startsAt,
        to: slots[slots.length - 1].endsAt,
      }
    })
    .filter((range): range is OpenRange => range !== null)
  const city =
    calendar.timezone.split("/").pop()?.replace(/_/g, " ") ?? calendar.timezone
  const timezoneLabel = `${city} · ${gmtLabel(now, calendar.timezone)}`
  const openDays = openRanges.length
  const hasTimes = availability.length > 0 && openDays > 0
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 lg:max-w-2xl lg:px-8 lg:py-10">
      {/*
        Action first. The old layout put the identity, a meta card, a seven-row
        opening-hours table and a privacy note above the wizard, so a phone
        scrolled through four boxes before the customer could tap anything —
        and that table only repeats what the greyed-out date picker shows.
        Now: a compact header, then the booking, then the detail for whoever
        wants it. Desktop gets the detail as a column instead of a disclosure.
      */}
      <header className="mb-6 lg:mb-8">
        <div className="flex items-start gap-3 sm:gap-4">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-base font-semibold text-primary ring-1 ring-primary/15 sm:size-14 sm:text-lg"
          >
            {initialsOf(calendar.name)}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl lg:text-3xl">
              {calendar.name}
            </h1>
            {/* Duration and zone ride in the header: they are the two facts
                that decide whether someone books at all. */}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4 shrink-0" aria-hidden />
                {calendar.duration_minutes} minutes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Globe className="size-4 shrink-0" aria-hidden />
                {timezoneLabel}
              </span>
            </p>
          </div>
        </div>
        {calendar.description ? (
          <p className="mt-3 max-w-prose text-sm text-pretty text-muted-foreground sm:mt-4 sm:text-base">
            {calendar.description}
          </p>
        ) : null}
      </header>
      {hasTimes ? (
        <BookingFlow
          calendarId={calendar.id}
          calendarName={calendar.name}
          durationMinutes={calendar.duration_minutes}
          timezone={calendar.timezone}
          timezoneLabel={timezoneLabel}
          fields={fields}
          openRanges={openRanges}
          horizonDays={calendar.booking_horizon_days}
        />
      ) : (
        <div className="rounded-2xl bg-card p-6 text-center ring-1 ring-border">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarOff className="size-6" aria-hidden />
          </span>
          <p className="mt-3 font-medium">Walang bukás na oras sa ngayon</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-pretty text-muted-foreground">
            Wala pang bakante sa mga susunod na araw. Pakibalikan po ito mamaya,
            o mag-message na lang muna kayo.
          </p>
        </div>
      )}

      <p className="mt-6 flex items-start justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span className="text-pretty">
          Ang mga detalyeng ibibigay mo ay para lang sa booking na ito.
        </span>
      </p>
    </div>
  )
}


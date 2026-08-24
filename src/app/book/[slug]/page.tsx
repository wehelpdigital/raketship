import type { ReactNode } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CalendarCheck, Clock, Globe, ShieldCheck } from "lucide-react"

import { BookingFlow, type BookingDay } from "@/features/booking/booking-flow"
import {
  buildSlots,
  isoDateInZone,
  summariseAvailability,
  upcomingDates,
  zoneOffsetMinutes,
  zonedTimeToInstant,
  type SlotRules,
} from "@/lib/booking/slots"
import { bookingUrl } from "@/lib/booking/slug"
import { env } from "@/lib/env"
import { getPublishedCalendar, getTakenSlots } from "@/lib/queries/booking"

/**
 * How far ahead this page offers. The action behind it enforces its own, wider
 * bound, so this can be shortened or stretched a little without a server
 * change — anything beyond a couple of months needs both.
 */
const HORIZON_DAYS = 14

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

  const dates = upcomingDates(now, HORIZON_DAYS, calendar.timezone)
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

  // Which days are worth tapping, decided on the server. The flow still asks
  // for the actual times when a date is picked — this only greys out the
  // obviously shut days so nobody taps into an empty list.
  const days: BookingDay[] = dates.map((iso) => ({
    iso,
    open:
      buildSlots({
        isoDate: iso,
        rules,
        availability,
        blackouts,
        taken,
        now,
      }).length > 0,
  }))

  const city =
    calendar.timezone.split("/").pop()?.replace(/_/g, " ") ?? calendar.timezone
  const timezoneLabel = `${city} · ${gmtLabel(now, calendar.timezone)}`
  const openDays = days.filter((day) => day.open).length

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 md:max-w-3xl lg:max-w-5xl lg:px-8 lg:py-10 xl:max-w-6xl">
      {/*
        Phone: identity first, then the picker, one column. From `lg` the
        identity moves into a sticky third of the width and stays readable while
        the customer scrolls the times — which is when they most want to check
        they are on the right page.
      */}
      <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
        <aside className="space-y-4 lg:sticky lg:top-8 lg:col-span-1 lg:self-start">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-base font-semibold text-primary lg:size-14 lg:text-lg"
            >
              {initialsOf(calendar.name)}
            </span>
            <div className="min-w-0 space-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-balance lg:text-2xl xl:text-3xl">
                {calendar.name}
              </h1>
              <p className="text-xs font-medium text-muted-foreground">
                Booking page
              </p>
            </div>
          </div>

          {calendar.description ? (
            <p className="text-sm text-pretty text-muted-foreground">
              {calendar.description}
            </p>
          ) : null}

          <dl className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-border">
            <MetaRow
              icon={<Clock className="size-4" aria-hidden />}
              label="Haba ng booking"
              value={`${calendar.duration_minutes} minutes`}
            />
            {/*
              The single biggest source of confusion on a booking page, so it is
              stated outright rather than implied by the times themselves.
            */}
            <MetaRow
              icon={<Globe className="size-4" aria-hidden />}
              label="Oras na ipinapakita"
              value={timezoneLabel}
              hint={`Lahat ng oras dito ay sa ${calendar.timezone}.`}
            />
            <MetaRow
              icon={<CalendarCheck className="size-4" aria-hidden />}
              label="Bukás na araw"
              value={summariseAvailability(availability)}
            />
          </dl>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="text-pretty">
              Ang mga detalyeng ibibigay mo ay para lang sa booking na ito.
            </span>
          </p>
        </aside>

        <div className="lg:col-span-2">
          {availability.length === 0 || openDays === 0 ? (
            <div className="mb-4 rounded-xl bg-card px-4 py-3 text-sm ring-1 ring-border">
              <p className="font-medium">Walang bukás na oras sa ngayon</p>
              <p className="mt-0.5 text-pretty text-muted-foreground">
                Wala pang bakante sa susunod na dalawang linggo. Pakibalikan po
                ito mamaya, o mag-message na lang muna kayo.
              </p>
            </div>
          ) : null}

          <BookingFlow
            calendarId={calendar.id}
            calendarName={calendar.name}
            durationMinutes={calendar.duration_minutes}
            timezone={calendar.timezone}
            timezoneLabel={timezoneLabel}
            fields={fields}
            days={days}
          />
        </div>
      </div>
    </div>
  )
}

function MetaRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0 space-y-0.5">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium text-pretty">{value}</dd>
        {hint ? (
          <dd className="text-xs text-pretty text-muted-foreground">{hint}</dd>
        ) : null}
      </div>
    </div>
  )
}

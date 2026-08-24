import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CalendarOff, ShieldCheck } from "lucide-react"
import {
  BookingFlow,
  type OpenRange,
  type PublicService,
} from "@/features/booking/booking-flow"
import {
  buildSlots,
  formatDuration,
  isoDateInZone,
  upcomingDates,
  zoneOffsetMinutes,
  zonedTimeToInstant,
  type SlotRules,
} from "@/lib/booking/slots"
import { BusinessHeader } from "@/features/business/business-header"
import { BusinessFooter } from "@/features/business/business-footer"
import { PaletteStyle } from "@/components/shell/palette-style"
import { CHALLENGE_BITS, issueChallenge } from "@/lib/booking/captcha"
import { bookingUrl } from "@/lib/booking/slug"
import { env } from "@/lib/env"
import { getPublishedCalendar, getTakenSlots } from "@/lib/queries/booking"
import { getPublicBusinessProfile } from "@/lib/queries/business"
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
    (detail.services.length > 0 && calendar.length_mode === "catalog"
      ? `Pumili ng serbisyo at oras para sa ${calendar.name}.`
      : `Pumili ng oras para sa ${calendar.name}. ${calendar.duration_minutes} minutes bawat booking.`)
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
  const { calendar, availability, blackouts, fields, services } = detail

  /*
    The business behind the link. Scoped by the OWNER's id read off the calendar
    row, never off the request — and readable at all only because the
    "published owner is public" policy opens while that owner has a live
    calendar. A missing row is normal, not an error: the page simply shows no
    branding.
  */
  const business = await getPublicBusinessProfile(calendar.user_id)

  /*
    A fresh anti-robot challenge for this visit. Minted on the server so the
    browser is never trusted to say it passed, and issued on every render so a
    cached page cannot hand two visitors the same one.
  */
  const challenge = issueChallenge()

  /*
    Trimmed to what the page actually renders. The stored rows carry the
    owner's id and timestamps, and this markup goes to anyone with the link.
  */
  const publicServices: PublicService[] = services.map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description,
    priceCentavos: service.price_centavos,
    durationMinutes: service.duration_minutes,
  }))

  const catalog = calendar.length_mode === "catalog" && publicServices.length > 0

  /*
    Which days to grey out is decided before anyone has picked a service, so
    the shortest one is used: a day where only a quick trim still fits is open,
    and greying it out would hide a bookable slot. This over-approximates by
    design — tapping a day refetches with the real length, and that is what
    actually decides.
  */
  const rangeDuration = catalog
    ? Math.min(...publicServices.map((service) => service.durationMinutes))
    : calendar.duration_minutes
  const now = new Date()
  const rules: SlotRules = {
    timezone: calendar.timezone,
    durationMinutes: rangeDuration,
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
      {/* The OWNER's colour, not the visitor's — this page is their shopfront.
          Server-rendered so it is in the first byte, with no flash of red. */}
      <PaletteStyle preset={business?.theme_preset} />
      {/*
        Action first. The old layout put the identity, a meta card, a seven-row
        opening-hours table and a privacy note above the wizard, so a phone
        scrolled through four boxes before the customer could tap anything —
        and that table only repeats what the greyed-out date picker shows.
        Now: a compact header, then the booking, then the detail for whoever
        wants it. Desktop gets the detail as a column instead of a disclosure.
      */}
      <BusinessHeader
        business={business}
        fallbackName={calendar.name}
        bookingName={calendar.name}
        timeLabel={
          catalog
            ? publicServices.length === 1
              ? formatDuration(publicServices[0].durationMinutes)
              : `${publicServices.length} serbisyo`
            : formatDuration(calendar.duration_minutes)
        }
        zoneLabel={timezoneLabel}
      />

      {calendar.description ? (
        <p className="mb-6 max-w-prose text-sm text-pretty text-muted-foreground sm:text-base lg:mb-8">
          {calendar.description}
        </p>
      ) : null}
      {hasTimes ? (
        <BookingFlow
          calendarId={calendar.id}
          calendarName={calendar.name}
          durationMinutes={calendar.duration_minutes}
          lengthMode={calendar.length_mode}
          services={publicServices}
          timezone={calendar.timezone}
          timezoneLabel={timezoneLabel}
          fields={fields}
          openRanges={openRanges}
          horizonDays={calendar.booking_horizon_days}
          challenge={challenge}
          challengeBits={CHALLENGE_BITS}
          cancelNoticeHours={calendar.cancel_notice_hours}
          contact={
            business
              ? {
                  mobile: business.mobile_number,
                  chatApps: business.chat_apps ?? [],
                  facebookUrl: business.facebook_url,
                  instagramHandle: business.instagram_handle,
                  websiteUrl: business.website_url,
                }
              : null
          }
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

      <BusinessFooter business={business} />

      <p className="mt-6 flex items-start justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span className="text-pretty">
          Ang mga detalyeng ibibigay mo ay para lang sa booking na ito.
        </span>
      </p>
    </div>
  )
}


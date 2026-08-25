import type { Metadata } from "next"
import Link from "next/link"
import { CalendarCheck, CalendarClock, ChevronLeft } from "lucide-react"

import { PageContainer, PageHeader } from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import { BookedTabs } from "@/features/booking/booked-tabs"
import type { BookedRow } from "@/features/booking/booked-list"
import { supabaseConfigured } from "@/lib/env"
import { getT } from "@/lib/i18n/server"
import { listBookedForOwner, type OwnerBooking } from "@/lib/queries/booking"
import { getCurrentUser } from "@/lib/supabase/server"
import type { AnswerValue } from "@/lib/booking/fields"

export const metadata: Metadata = { title: "Booked" }

/**
 * Everything that came in through the public booking pages.
 *
 * A static segment, so it deliberately shadows /modules/booking/[calendarId]
 * the same way /modules/booking shadows /modules/[moduleId]. Calendar ids are
 * uuids, so "booked" can never be one of them.
 *
 * The page is a working list rather than a reading column: rows collapse to a
 * scannable line and open one at a time, and the searching, filtering and
 * growing happen in the browser over rows already loaded. See BookedBrowser
 * for why that is client-side.
 */
export default async function BookedPage() {
  const t = await getT()
  const user = await getCurrentUser()

  if (!supabaseConfigured || !user) {
    return (
      <PageContainer>
        <PageHeader
          title={t("booked.title")}
          description={t("booked.subtitle")}
        />
        <SetupNotice />
      </PageContainer>
    )
  }

  const { upcoming, past, cancelled, fieldsByCalendar } =
    await listBookedForOwner(user.id)

  /*
    Named from the bookings themselves rather than by loading every calendar:
    a filter offering a calendar with nothing on it is a dead end, and the
    names are already here.
  */
  const calendars = Array.from(
    new Map(
      [...upcoming, ...past, ...cancelled].map((b) => [
        b.calendar_id,
        { id: b.calendar_id, name: b.calendar?.name ?? "Booking" },
      ])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  const total = upcoming.length + past.length + cancelled.length

  return (
    <PageContainer>
      <div className="space-y-4">
        <Link
          href="/modules/booking"
          className="-ml-2 inline-flex h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {t("booked.back")}
        </Link>

        <PageHeader
          title={t("booked.title")}
          description={t("booked.subtitle")}
        />
      </div>

      {total === 0 ? (
        <div className="rounded-2xl bg-card p-8 text-center ring-1 ring-border">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarCheck className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-3 font-medium">{t("booked.empty.title")}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-pretty text-muted-foreground">
            {t("booked.empty.body")}
          </p>
          <Link
            href="/modules/booking"
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <CalendarClock className="size-4" aria-hidden="true" />
            {t("booked.empty.action")}
          </Link>
        </div>
      ) : (
        <BookedTabs
          upcoming={upcoming.map(toRow)}
          past={past.map(toRow)}
          cancelled={cancelled.map(toRow)}
          fieldsByCalendar={fieldsByCalendar}
          calendars={calendars}
        />
      )}
    </PageContainer>
  )
}

/**
 * Flattens a row for the client.
 *
 * The duration is derived from the booking's OWN start and end rather than
 * from the calendar's current setting: a booking made when a haircut took
 * thirty minutes still took thirty minutes after the owner changed it to
 * forty-five.
 */
function toRow(booking: OwnerBooking): BookedRow {
  const minutes = Math.max(
    0,
    Math.round(
      (new Date(booking.ends_at).getTime() -
        new Date(booking.starts_at).getTime()) /
        60000
    )
  )

  return {
    id: booking.id,
    calendarId: booking.calendar_id,
    calendarName: booking.calendar?.name ?? "Booking",
    timezone: booking.calendar?.timezone ?? "Asia/Manila",
    startsAt: booking.starts_at,
    endsAt: booking.ends_at,
    status: booking.status,
    customerName: booking.customer_name,
    customerEmail: booking.customer_email,
    customerPhone: booking.customer_phone,
    serviceName: booking.service_name,
    servicePriceCentavos: booking.service_price_centavos,
    durationMinutes: minutes,
    answers: (booking.answers ?? {}) as Record<string, AnswerValue>,
    createdAt: booking.created_at,
  }
}

import type { Metadata } from "next"
import Link from "next/link"
import { CalendarCheck, CalendarClock, ChevronLeft, Lock } from "lucide-react"

import { PageContainer, PageHeader } from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookedBrowser } from "@/features/booking/booked-browser"
import type { BookedRow } from "@/features/booking/booked-list"
import { supabaseConfigured } from "@/lib/env"
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
 * paging happen in the browser over rows already loaded. See BookedBrowser for
 * why that is client-side.
 */
export default async function BookedPage() {
  const user = await getCurrentUser()

  if (!supabaseConfigured || !user) {
    return (
      <PageContainer>
        <PageHeader
          title="Booked"
          description="Ang mga booking na dumating sa public link mo."
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
          Booking
        </Link>

        <PageHeader
          title="Booked"
          description="Ang mga booking na dumating sa public link mo."
        />
      </div>

      {total === 0 ? (
        <EmptyState />
      ) : (
        <Tabs defaultValue="upcoming" className="gap-4 lg:gap-6">
          {/* Full-bleed scroller: three labels with counts do not fit across a
              320px phone, and widening the page would break every other one. */}
          <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
            <TabsList className="w-max group-data-[orientation=horizontal]/tabs:h-auto">
              <TabsTrigger value="upcoming" className="h-11 px-3 lg:h-9">
                Paparating
                <Count n={upcoming.length} />
              </TabsTrigger>
              <TabsTrigger value="past" className="h-11 px-3 lg:h-9">
                Tapos na
                <Count n={past.length} />
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="h-11 px-3 lg:h-9">
                Cancelled
                <Count n={cancelled.length} />
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="upcoming" keepMounted>
            <div className="space-y-4">
              {upcoming.length > 0 ? <SlotNotice /> : null}
              <BookedBrowser
                rows={upcoming.map(toRow)}
                fieldsByCalendar={fieldsByCalendar}
                calendars={calendars}
                emptyLabel="Walang paparating na booking. Ang mga bagong booking sa public link mo ay lalabas dito."
              />
            </div>
          </TabsContent>

          <TabsContent value="past" keepMounted>
            <BookedBrowser
              rows={past.map(toRow)}
              fieldsByCalendar={fieldsByCalendar}
              calendars={calendars}
              emptyLabel="Wala pang natapos na booking."
            />
          </TabsContent>

          <TabsContent value="cancelled" keepMounted>
            <div className="space-y-4">
              {cancelled.length > 0 ? (
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-pretty text-muted-foreground">
                  Bakante na ulit ang mga oras na ito — pwede na silang kunin ng
                  iba.
                </p>
              ) : null}
              <BookedBrowser
                rows={cancelled.map(toRow)}
                fieldsByCalendar={fieldsByCalendar}
                calendars={calendars}
                variant="cancelled"
                emptyLabel="Walang na-cancel. Mabuti iyon."
              />
            </div>
          </TabsContent>
        </Tabs>
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

/** States plainly what the slot engine already enforces. */
function SlotNotice() {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-primary/8 px-3 py-2 text-sm text-pretty ring-1 ring-primary/20">
      <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="text-muted-foreground">
        Sarado na ang mga oras na ito sa public page mo — hindi na sila
        mapipili ng iba. Kapag na-cancel mo ang isa, babalik itong bakante.
      </span>
    </p>
  )
}

function Count({ n }: { n: number }) {
  if (n === 0) return null
  return (
    <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
      {n}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-card p-8 text-center ring-1 ring-border">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CalendarCheck className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-3 font-medium">Wala pang booking</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-pretty text-muted-foreground">
        Kapag may kumuha ng oras sa public link mo, lalabas sila dito — kasama
        ang pangalan, contact at mga sagot nila sa form mo.
      </p>
      <Link
        href="/modules/booking"
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <CalendarClock className="size-4" aria-hidden="true" />
        Tingnan ang mga calendar
      </Link>
    </div>
  )
}

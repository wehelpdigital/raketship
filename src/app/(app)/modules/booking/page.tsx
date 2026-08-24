import type { ReactNode } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  Link2,
  ListChecks,
  Send,
} from "lucide-react"

import { ModuleIcon } from "@/components/module-icon"
import { accentChip } from "@/components/shell/module-nav"
import { PageContainer, PageHeader } from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CalendarCard } from "@/features/booking/calendar-card"
import { NewCalendarDialog } from "@/features/booking/new-calendar-dialog"
import { bookingUrl } from "@/lib/booking/slug"
import { env, supabaseConfigured } from "@/lib/env"
import { listCalendars } from "@/lib/queries/booking"
import { getModule } from "@/lib/queries/catalog"
import { getWorkspace } from "@/lib/queries/workspace"
import { getCurrentUser } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Booking",
  description: "Booking calendars, availability and public links.",
}

const MODULE_ID = "booking"

/**
 * A small number that reads at a glance on desktop, where the three-up grid
 * leaves a whole row of width doing nothing on a short list.
 */
function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:p-4 lg:p-5">
      <p className="text-xs font-medium text-muted-foreground lg:text-sm">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums lg:text-3xl">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{hint}</p>
    </div>
  )
}

function Step({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof CalendarDays
  title: string
  children: ReactNode
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-chart-1/12 text-chart-1">
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-sm text-pretty text-muted-foreground">
          {children}
        </span>
      </span>
    </li>
  )
}

export default async function BookingModulePage() {
  const user = await getCurrentUser()

  if (!supabaseConfigured || !user) {
    return (
      <PageContainer>
        <SetupNotice />
      </PageContainer>
    )
  }

  const [mod, workspace] = await Promise.all([
    getModule(MODULE_ID),
    getWorkspace(user.id),
  ])

  const name = mod?.name ?? "Booking"
  const icon = mod?.icon ?? "CalendarCheck"
  const accent = mod?.accent ?? "chart-1"

  const heading = (
    <span className="flex items-center gap-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl lg:size-12",
          accentChip(accent)
        )}
      >
        <ModuleIcon name={icon} className="size-5 lg:size-6" aria-hidden="true" />
      </span>
      {name}
    </span>
  )

  const active = workspace.modules.some(
    (m) => m.module_id === MODULE_ID && m.status === "active"
  )

  // Not their module yet: send them to the listing rather than showing an
  // empty shell they cannot fill.
  if (!active) {
    return (
      <PageContainer>
        <PageHeader
          title={heading}
          description="You have not added Booking to your raket yet."
        />
        <Card>
          <CardContent className="space-y-4">
            <p className="max-w-prose text-sm text-pretty text-muted-foreground">
              {mod?.description ??
                "Let suki pick a slot from your own hours, answer the questions you need, and get a confirmation — all from one link."}
            </p>
            <Link
              href={`/marketplace/${MODULE_ID}`}
              className={cn(buttonVariants(), "h-11 w-full gap-2 sm:w-auto")}
            >
              See it in the marketplace
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  const calendars = await listCalendars(user.id)
  const published = calendars.filter((c) => c.is_published).length
  const bookings = calendars.reduce((sum, c) => sum + c.bookingCount, 0)

  return (
    <PageContainer>
      <PageHeader
        title={heading}
        description={
          calendars.length > 0
            ? "Each calendar has its own hours, its own questions and its own link."
            : (mod?.tagline ?? "Take appointments online.")
        }
        action={
          calendars.length > 0 ? (
            <NewCalendarDialog label="New" className="sm:hidden" />
          ) : null
        }
      />

      {calendars.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Three tiles wide even on a 320px phone: the numbers are short,
              and stacking them would push the calendars below the fold. */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
            <Stat
              label="Calendars"
              value={String(calendars.length)}
              hint={calendars.length === 1 ? "one set up" : "set up"}
            />
            <Stat
              label="Live"
              value={String(published)}
              hint={published === 0 ? "none shared yet" : "taking bookings"}
            />
            <Stat
              label="Booked"
              value={String(bookings)}
              hint="slots taken so far"
            />
          </div>

          <section className="space-y-3 lg:space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-tight lg:text-base">
                Your calendars
              </h2>
              <div className="hidden sm:block">
                <NewCalendarDialog />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
              {calendars.map((calendar) => (
                <CalendarCard
                  key={calendar.id}
                  calendar={calendar}
                  bookingCount={calendar.bookingCount}
                  serviceCount={calendar.serviceCount}
                  publicUrl={bookingUrl(calendar.slug, env.siteUrl)}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </PageContainer>
  )
}

/**
 * The first thing most people see here, so it explains what a booking calendar
 * is before it asks for one. Two columns from lg: the invitation on the left,
 * what they actually get on the right.
 */
function EmptyState() {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
      <Card className="lg:col-span-2">
        <CardContent className="space-y-5 py-2 lg:py-6">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-chart-1/12 text-chart-1 lg:size-14">
            <CalendarClock className="size-6 lg:size-7" aria-hidden="true" />
          </span>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-balance lg:text-2xl">
              Your appointment book, online
            </h2>
            <p className="max-w-prose text-sm text-pretty text-muted-foreground lg:text-base">
              A booking calendar holds the days and hours you are free. Share
              its link and your suki picks a slot themselves — no more
              back-and-forth sa chat, and no two people booked at 3pm.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <NewCalendarDialog
              label="Create your first calendar"
              className="w-full sm:w-auto"
            />
            <Link
              href={`/marketplace/${MODULE_ID}`}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-11 w-full gap-2 sm:w-auto"
              )}
            >
              What else can it do?
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 py-2 lg:py-4">
          <h3 className="text-sm font-semibold tracking-tight">
            Three things to set
          </h3>
          <ol className="space-y-4">
            <Step icon={CalendarDays} title="Your days and hours">
              Pick the weekdays you work and the times you take people. Close
              off specific dates — holidays, fiesta, a day off.
            </Step>
            <Step icon={ListChecks} title="What you need to know">
              Build the questions your suki answers when booking: their number,
              what service, a photo, kahit ano.
            </Step>
            <Step icon={Link2} title="One link to share">
              Publish it and you get a short link you can post, print on a
              tarpaulin, or send in a message.
            </Step>
          </ol>
          <p className="flex items-start gap-2 border-t border-border pt-4 text-xs text-pretty text-muted-foreground">
            <Send className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Nothing goes live until you publish, so you can set it up at your
              own pace.
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

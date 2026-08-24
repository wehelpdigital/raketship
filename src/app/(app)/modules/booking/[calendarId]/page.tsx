import type { ReactNode } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  CalendarOff,
  ChevronLeft,
  Clock,
  ExternalLink,
  Globe2,
  ListChecks,
  Timer,
} from "lucide-react"

import { PageContainer, PageHeader } from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AvailabilityEditor } from "@/features/booking/availability-editor"
import { CalendarForm } from "@/features/booking/calendar-form"
import { FormBuilder } from "@/features/booking/form-builder"
import { SharePanel } from "@/features/booking/share-panel"
import { groupAvailabilityByDay } from "@/lib/booking/slots"
import { bookingUrl } from "@/lib/booking/slug"
import { env, supabaseConfigured } from "@/lib/env"
import { getCalendar } from "@/lib/queries/booking"
import { getCurrentUser } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

interface PageProps {
  params: Promise<{ calendarId: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { calendarId } = await params
  const user = await getCurrentUser()
  if (!user) return { title: "Booking" }
  const detail = await getCalendar(user.id, calendarId)
  return { title: detail ? `${detail.calendar.name} · Booking` : "Booking" }
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-pretty">{children}</p>
      </div>
    </div>
  )
}

export default async function CalendarEditorPage({ params }: PageProps) {
  const { calendarId } = await params
  const user = await getCurrentUser()

  if (!supabaseConfigured || !user) {
    return (
      <PageContainer>
        <SetupNotice />
      </PageContainer>
    )
  }

  const detail = await getCalendar(user.id, calendarId)
  // getCalendar filters by user_id, so "someone else's calendar" and "no such
  // calendar" are deliberately the same answer.
  if (!detail) notFound()

  const { calendar, availability, blackouts, fields } = detail
  const publicUrl = bookingUrl(calendar.slug, env.siteUrl)

  return (
    <PageContainer>
      <div className="space-y-4">
        <Link
          href="/modules/booking"
          className="-ml-2 inline-flex h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          All calendars
        </Link>

        <PageHeader
          title={calendar.name}
          description={calendar.description}
          action={
            <Badge variant={calendar.is_published ? "default" : "outline"}>
              {calendar.is_published ? "Published" : "Draft"}
            </Badge>
          }
        />

        {calendar.is_published ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 max-w-full items-center gap-2 rounded-lg bg-muted/60 px-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="min-w-0 truncate font-mono text-xs">
              {publicUrl.replace(/^https?:\/\//, "")}
            </span>
            <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">Open your public booking page</span>
          </a>
        ) : null}
      </div>

      <Tabs defaultValue="details" className="gap-4 lg:gap-6">
        {/* Full-bleed scroller: four labels do not fit across a 320px phone,
            and widening the page instead would break every other screen. */}
        <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          <TabsList className="w-max group-data-[orientation=horizontal]/tabs:h-auto">
            <TabsTrigger value="details" className="h-11 px-3 lg:h-9">
              Details
            </TabsTrigger>
            <TabsTrigger value="availability" className="h-11 px-3 lg:h-9">
              Availability
            </TabsTrigger>
            <TabsTrigger value="questions" className="h-11 px-3 lg:h-9">
              Questions
            </TabsTrigger>
            <TabsTrigger value="share" className="h-11 px-3 lg:h-9">
              Share
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="details" keepMounted>
          <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
            <Card className="lg:col-span-2">
              <CardContent className="py-2 lg:py-4">
                <CalendarForm mode="edit" calendar={calendar} />
              </CardContent>
            </Card>

            {/* The read-only half: what the other three tabs have set, so the
                owner can tell at a glance whether this calendar is finished. */}
            <Card>
              <CardContent className="space-y-4 py-2 lg:py-4">
                <h2 className="text-sm font-semibold tracking-tight">
                  Summary
                </h2>

                {/* One row per day. Joined into a single line this became a
                    run-on of days and times that nobody could read. */}
                <div className="space-y-1.5">
                  <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                    Days and hours
                  </p>
                  <dl className="overflow-hidden rounded-lg ring-1 ring-border">
                    {groupAvailabilityByDay(availability).map((day) => (
                      <div
                        key={day.weekday}
                        className="flex items-baseline gap-3 border-b border-border/60 px-3 py-1.5 last:border-b-0 odd:bg-muted/30"
                      >
                        <dt className="w-10 shrink-0 text-xs font-medium">
                          <abbr title={day.long} className="no-underline">
                            {day.short}
                          </abbr>
                        </dt>
                        <dd
                          className={cn(
                            "min-w-0 flex-1 text-right text-xs tabular-nums",
                            day.ranges.length === 0
                              ? "text-muted-foreground/60"
                              : "text-foreground"
                          )}
                        >
                          {day.ranges.length === 0 ? (
                            "Closed"
                          ) : (
                            <span className="flex flex-col items-end gap-0.5">
                              {day.ranges.map((range) => (
                                <span key={range}>{range}</span>
                              ))}
                            </span>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <Fact icon={Globe2} label="Timezone">
                  {`Those hours are read as ${calendar.timezone} time (${calendar.country}).`}{" "}
                  Change it under Availability.
                </Fact>
                <Fact icon={CalendarOff} label="Closed dates">
                  {blackouts.length === 0
                    ? "None set"
                    : blackouts.length === 1
                      ? "1 date closed"
                      : `${blackouts.length} dates closed`}
                </Fact>
                <Fact icon={ListChecks} label="Questions asked">
                  {fields.length === 0
                    ? "Name and contact only"
                    : fields.length === 1
                      ? "1 question"
                      : `${fields.length} questions`}
                </Fact>
                <Fact icon={Timer} label="Notice needed">
                  {calendar.notice_hours === 0
                    ? "Suki can book any open slot, even later today"
                    : `${calendar.notice_hours} ${
                        calendar.notice_hours === 1 ? "hour" : "hours"
                      } before the slot`}
                </Fact>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="availability" keepMounted>
          <AvailabilityEditor
            calendar={calendar}
            availability={availability}
            blackouts={blackouts}
          />
        </TabsContent>

        <TabsContent value="questions" keepMounted>
          <FormBuilder calendarId={calendar.id} fields={fields} />
        </TabsContent>

        <TabsContent value="share" keepMounted>
          <SharePanel calendar={calendar} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}

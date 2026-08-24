import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, ExternalLink } from "lucide-react"

import { PageContainer, PageHeader } from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AvailabilityEditor } from "@/features/booking/availability-editor"
import { CalendarForm } from "@/features/booking/calendar-form"
import { FormBuilder } from "@/features/booking/form-builder"
import { LengthPanel } from "@/features/booking/length-panel"
import { SharePanel } from "@/features/booking/share-panel"
import { bookingUrl } from "@/lib/booking/slug"
import { env, supabaseConfigured } from "@/lib/env"
import { getCalendar } from "@/lib/queries/booking"
import { getCurrentUser } from "@/lib/supabase/server"

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

  const { calendar, availability, blackouts, fields, services } = detail
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
        {/* Full-bleed scroller: five labels do not fit across a 320px phone,
            and widening the page instead would break every other screen. */}
        <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          <TabsList className="w-max group-data-[orientation=horizontal]/tabs:h-auto">
            <TabsTrigger value="details" className="h-11 px-3 lg:h-9">
              Details
            </TabsTrigger>
            <TabsTrigger value="length" className="h-11 px-3 lg:h-9">
              Length
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
          <Card>
            <CardContent className="py-2 lg:py-4">
              <CalendarForm mode="edit" calendar={calendar} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="length" keepMounted>
          <LengthPanel calendar={calendar} services={services} />
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

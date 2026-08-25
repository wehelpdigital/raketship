import type { Metadata } from "next"
import Link from "next/link"
import { UserCheck } from "lucide-react"

import { PageContainer, PageHeader } from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import { ClientTable } from "@/features/clients/client-table"
import { deriveClients } from "@/lib/clients/derive"
import { supabaseConfigured } from "@/lib/env"
import { listBookedForOwner } from "@/lib/queries/booking"
import { getWorkspace } from "@/lib/queries/workspace"
import { getCurrentUser } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Client Manager",
  description: "Lahat ng suki mo, sa isang lista.",
}

/**
 * The Client Manager: everyone who booked, folded into people.
 *
 * A static segment shadowing /modules/[moduleId], exactly like booking and
 * business. It owns no tables — the clients are DERIVED from the bookings on
 * every visit, so the list is always exactly as current as the bookings are
 * and cancelling a booking can never leave a stale copy here.
 */
export default async function ClientManagerPage() {
  const user = await getCurrentUser()

  if (!supabaseConfigured || !user) {
    return (
      <PageContainer>
        <PageHeader
          title="Client Manager"
          description="Lahat ng suki mo, sa isang lista."
        />
        <SetupNotice />
      </PageContainer>
    )
  }

  const workspace = await getWorkspace(user.id)
  const active = workspace.modules.some(
    (m) => m.module_id === "client-manager" && m.status === "active"
  )

  if (!active) {
    return (
      <PageContainer>
        <PageHeader
          title="Client Manager"
          description="Lahat ng suki mo, sa isang lista."
        />
        <div className="rounded-lg bg-card p-8 text-center ring-1 ring-border">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-chart-4/12 text-chart-4">
            <UserCheck className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-3 font-medium">Hindi pa bukas ang Client Manager</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-pretty text-muted-foreground">
            Buksan ito sa Booking, sa tab na &ldquo;What&apos;s next&rdquo; —
            at lalabas dito ang lahat ng nag-book, kasama ang mga sagot nila.
          </p>
          <Link
            href="/modules/booking"
            className="mt-4 inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Pumunta sa Booking
          </Link>
        </div>
      </PageContainer>
    )
  }

  const { upcoming, past, cancelled, fieldsByCalendar } =
    await listBookedForOwner(user.id)
  const clients = deriveClients(
    [...upcoming, ...past, ...cancelled],
    fieldsByCalendar
  )

  const calendars = Array.from(
    new Set(clients.flatMap((client) => client.calendars))
  ).sort((a, b) => a.localeCompare(b))

  return (
    <PageContainer>
      <PageHeader
        title="Client Manager"
        description="Lahat ng nag-book, kasama ang bawat sagot nila — laging kasing-bago ng mga booking mo."
      />
      <ClientTable clients={clients} calendars={calendars} />
    </PageContainer>
  )
}

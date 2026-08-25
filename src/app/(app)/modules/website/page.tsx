import type { Metadata } from "next"
import Link from "next/link"
import { Globe } from "lucide-react"

import { PageContainer, PageHeader } from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import { supabaseConfigured } from "@/lib/env"
import { getWorkspace } from "@/lib/queries/workspace"
import { getCurrentUser } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Website",
  description: "Ang sariling page ng negosyo mo.",
}

/**
 * The Website module — a placed part with nothing behind it yet.
 *
 * Deliberately empty: the module exists so it can be switched on, named on
 * the board and wired from the business while what it serves is being built.
 * A static segment shadowing /modules/[moduleId], like its siblings.
 */
export default async function WebsitePage() {
  const user = await getCurrentUser()

  if (!supabaseConfigured || !user) {
    return (
      <PageContainer>
        <PageHeader
          title="Website"
          description="Ang sariling page ng negosyo mo."
        />
        <SetupNotice />
      </PageContainer>
    )
  }

  const workspace = await getWorkspace(user.id)
  const active = workspace.modules.some(
    (m) => m.module_id === "website" && m.status === "active"
  )

  return (
    <PageContainer>
      <PageHeader
        title="Website"
        description="Ang sariling page ng negosyo mo."
      />

      <div className="rounded-lg bg-card p-8 text-center ring-1 ring-border">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-chart-5/12 text-chart-5">
          <Globe className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-3 font-medium">
          {active ? "Wala pa itong laman" : "Hindi pa bukas ang Website"}
        </p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-pretty text-muted-foreground">
          {active
            ? "Malapit na. Nakalagay na ang Website sa raket board mo — dito lalabas ang page ng negosyo mo kapag handa na."
            : "Buksan ito sa My raket parts, at lalabas ito sa Build your Raket na nakakabit sa negosyo mo."}
        </p>
        {!active ? (
          <Link
            href="/raket/parts"
            className="mt-4 inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Pumunta sa My raket parts
          </Link>
        ) : null}
      </div>
    </PageContainer>
  )
}

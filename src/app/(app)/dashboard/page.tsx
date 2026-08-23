import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, Rocket } from "lucide-react"

import { ModuleIcon } from "@/components/module-icon"
import {
  PageContainer,
  SectionHeading,
} from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import { supabaseConfigured } from "@/lib/env"
import { getCatalog, getPlans } from "@/lib/queries/catalog"
import { getWorkspace, type WorkspaceSummary } from "@/lib/queries/workspace"
import { getCurrentUser } from "@/lib/supabase/server"
import { cn, formatPeso } from "@/lib/utils"

export const metadata: Metadata = { title: "Home" }

/** Tailwind needs whole class names, so the accent scale is spelled out. */
const ACCENT_CLASSES: Record<string, string> = {
  "chart-1": "bg-chart-1/10 text-chart-1",
  "chart-2": "bg-chart-2/10 text-chart-2",
  "chart-3": "bg-chart-3/10 text-chart-3",
  "chart-4": "bg-chart-4/10 text-chart-4",
  "chart-5": "bg-chart-5/10 text-chart-5",
}

function accentClass(accent: string | null | undefined): string {
  return (accent && ACCENT_CLASSES[accent]) || ACCENT_CLASSES["chart-1"]
}

function firstNameOf(fullName?: string | null, email?: string | null): string {
  const name = (fullName ?? "").trim()
  if (name) return name.split(/\s+/)[0]
  const handle = (email ?? "").trim().split("@")[0]
  return handle || "kaibigan"
}

const EMPTY_WORKSPACE: WorkspaceSummary = {
  profile: null,
  subscription: null,
  modules: [],
  raket: null,
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  const [workspace, catalog, plans] = await Promise.all([
    user ? getWorkspace(user.id) : Promise.resolve(EMPTY_WORKSPACE),
    getCatalog(),
    getPlans(),
  ])

  const hasData = supabaseConfigured && catalog.length > 0
  const plan = workspace.subscription?.plan ?? null
  const basicPlan = plans.find((p) => p.id === "basic") ?? null

  const planName = plan?.name ?? "Libre"
  const planTagline = plan?.tagline ?? "Start your raket for free"
  const slots = plan?.module_slots ?? 1
  const isFree = (plan?.price_centavos ?? 0) === 0

  const active = workspace.modules.filter((m) => m.status === "active")
  const used = active.length
  const usedPct = Math.min(100, Math.round((used / Math.max(slots, 1)) * 100))

  const activatedIds = new Set(workspace.modules.map((m) => m.module_id))
  const suggestions = catalog
    .filter((m) => m.is_available && !activatedIds.has(m.id))
    .slice(0, 3)

  const greetingName = firstNameOf(
    workspace.profile?.full_name,
    workspace.profile?.email ?? user?.email
  )
  const businessName = workspace.profile?.business_name?.trim()

  return (
    <PageContainer>
      {hasData ? null : <SetupNotice />}

      <Card className="sm:[--card-spacing:--spacing(5)]">
        <CardHeader>
          <CardTitle className="text-lg text-balance">
            Kumusta, {greetingName}!
          </CardTitle>
          <CardDescription className="text-pretty">
            {businessName ? businessName : "Your raket is ready when you are."}
          </CardDescription>
          <CardAction>
            <Badge variant="secondary">{planName}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-pretty text-muted-foreground">
            Everything you run lives on one canvas. Drag a module in, connect
            it, and let it work while you serve your suki.
          </p>
          <Link
            href="/raket"
            className={cn(buttonVariants(), "h-11 w-full gap-2")}
          >
            <Rocket aria-hidden="true" />
            Open your Raket
          </Link>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <SectionHeading
          title="Your modules"
          action={
            <Link
              href="/marketplace"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "h-11 px-3"
              )}
            >
              Browse
            </Link>
          }
        />

        {active.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {active.map((item) => {
              return (
                <Link
                  key={item.id}
                  href="/raket"
                  className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-5"
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg",
                      accentClass(item.module?.accent)
                    )}
                  >
                    <ModuleIcon name={item.module?.icon} className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {item.module?.name ?? "Module"}
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        {item.tier?.name ?? "Starter"}
                      </Badge>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {item.module?.tagline ?? "Ready on your canvas"}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-dashed p-4 text-center sm:p-5">
            <span className="mx-auto flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ModuleIcon name="Blocks" className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium">Wala pang modules dito</p>
            <p className="text-sm text-pretty text-muted-foreground">
              Booking comes free with every account. Once it is on, it shows up
              here and on your canvas.
            </p>
            <Link
              href="/marketplace"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-11 w-full"
              )}
            >
              Go to the marketplace
            </Link>
          </div>
        )}
      </section>

      <Card className="sm:[--card-spacing:--spacing(5)]">
        <CardHeader>
          <CardTitle>Your plan</CardTitle>
          <CardDescription className="text-pretty">
            {planTagline}
          </CardDescription>
          <CardAction>
            <Badge variant={isFree ? "secondary" : "default"}>{planName}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={usedPct}>
            <ProgressLabel>Module slots</ProgressLabel>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {used} of {slots} used
            </span>
          </Progress>

          {isFree ? (
            <Link
              href="/marketplace"
              className={cn(buttonVariants(), "h-11 w-full gap-2")}
            >
              Upgrade to Basic ·{" "}
              {formatPeso(basicPlan?.price_centavos ?? 29900)}/mo
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">
              {formatPeso(plan?.price_centavos ?? 0)} per{" "}
              {plan?.billing_period ?? "month"} · renews automatically.
            </p>
          )}
        </CardContent>
      </Card>

      {suggestions.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading title="Add more to your raket" />
          <div className="space-y-3">
            {suggestions.map((module) => {
              const startsAt = module.tiers[0]?.price_centavos ?? 0
              return (
                <Link
                  key={module.id}
                  href={`/marketplace/${module.id}`}
                  className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-5"
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg",
                      accentClass(module.accent)
                    )}
                  >
                    <ModuleIcon name={module.icon} className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {module.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {module.tagline ?? "Add it when you need it"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {startsAt === 0 ? "Libre" : `from ${formatPeso(startsAt)}`}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      ) : null}
    </PageContainer>
  )
}

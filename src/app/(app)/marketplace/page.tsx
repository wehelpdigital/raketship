import type { Metadata } from "next"

import {
  PageContainer,
  PageHeader,
  SectionHeading,
} from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ModuleCard } from "@/features/marketplace/module-card"
import { PlanPicker } from "@/features/marketplace/plan-picker"
import { supabaseConfigured } from "@/lib/env"
import { getCatalog, getPlans, type CatalogModule } from "@/lib/queries/catalog"
import { getWorkspace, type WorkspaceSummary } from "@/lib/queries/workspace"
import { getCurrentUser } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Add only what your raket needs today.",
}

const EMPTY_WORKSPACE: WorkspaceSummary = {
  profile: null,
  subscription: null,
  modules: [],
  raket: null,
}

const CATEGORY_ORDER = [
  "sales",
  "finance",
  "operations",
  "relationships",
  "insights",
]

const CATEGORY_LABELS: Record<string, string> = {
  sales: "Sales",
  finance: "Finance",
  operations: "Operations",
  relationships: "Relationships",
  insights: "Insights",
}

/**
 * One ladder for every repeating card grid here: one column on phone, two from
 * sm, three at desktop. Four across was tried and rejected — at 1280px it left
 * each card barely 260px, which crops the longer module names.
 */
const CARD_GRID = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4"

function categoryLabel(id: string): string {
  return CATEGORY_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1)
}

/** Known categories first, then anything new the catalogue grows later. */
function categoriesIn(modules: CatalogModule[]): string[] {
  const present = Array.from(new Set(modules.map((m) => m.category)))
  return [
    ...CATEGORY_ORDER.filter((c) => present.includes(c)),
    ...present.filter((c) => !CATEGORY_ORDER.includes(c)),
  ]
}

function lowestPrice(mod: CatalogModule): number | null {
  const tiers = Array.isArray(mod.tiers) ? mod.tiers : []
  if (tiers.length === 0) return null
  return Math.min(...tiers.map((t) => t.price_centavos))
}

interface OwnedInfo {
  tierName: string | null
}

function ModuleGrid({
  modules,
  owned,
}: {
  modules: CatalogModule[]
  owned: Map<string, OwnedInfo>
}) {
  if (modules.length === 0) {
    return (
      <p className="max-w-prose text-sm text-pretty text-muted-foreground">
        Wala pang module dito. Try another tab.
      </p>
    )
  }

  return (
    <div className={CARD_GRID}>
      {modules.map((mod) => (
        <ModuleCard
          key={mod.id}
          module={mod}
          fromCentavos={lowestPrice(mod)}
          owned={owned.has(mod.id)}
          activeTier={owned.get(mod.id)?.tierName ?? null}
        />
      ))}
    </div>
  )
}

function EmptyGrid() {
  return (
    <div className={CARD_GRID}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5 lg:p-6"
        >
          <div className="flex items-start gap-3 lg:gap-4">
            <Skeleton className="size-11 shrink-0 rounded-xl lg:size-12 lg:rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
          <Skeleton className="mt-3 h-3 w-20 lg:mt-4" />
        </div>
      ))}
    </div>
  )
}

interface SlotsMeterProps {
  planName: string
  activeCount: number
  slots: number
  left: number
  used: number
  className?: string
}

/**
 * How many module slots the plan still has. A full-width card under the title
 * on phone and tablet; at desktop the caller lifts it into the right-hand
 * column beside the page title, which leaves the category strip below it the
 * whole width.
 */
function SlotsMeter({
  planName,
  activeCount,
  slots,
  left,
  used,
  className,
}: SlotsMeterProps) {
  return (
    <section
      aria-label="Plan usage"
      className={cn(
        "space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">{planName} plan</p>
          <p className="text-sm text-pretty text-muted-foreground">
            {activeCount} of {slots} module {slots === 1 ? "slot" : "slots"} in
            use
          </p>
        </div>
        <Badge variant={left === 0 ? "outline" : "secondary"}>
          {left === 0 ? "Puno na" : `${left} left`}
        </Badge>
      </div>
      <Progress value={used} aria-label="Module slots in use" />
    </section>
  )
}

export default async function MarketplacePage() {
  const user = await getCurrentUser()
  const [catalog, plans, workspace] = await Promise.all([
    getCatalog(),
    getPlans(),
    user ? getWorkspace(user.id) : Promise.resolve(EMPTY_WORKSPACE),
  ])

  const owned = new Map<string, OwnedInfo>(
    workspace.modules.map((m): [string, OwnedInfo] => [
      m.module_id,
      { tierName: m.tier?.name ?? null },
    ])
  )

  const activeCount = workspace.modules.filter(
    (m) => m.status === "active"
  ).length

  const plan = workspace.subscription?.plan ?? plans[0] ?? null
  const slots = Math.max(0, plan?.module_slots ?? 1)
  const left = Math.max(0, slots - activeCount)
  const used =
    slots > 0 ? Math.min(100, Math.round((activeCount / slots) * 100)) : 100

  const categories = categoriesIn(catalog)
  const ready = supabaseConfigured && catalog.length > 0

  if (!ready) {
    return (
      <PageContainer>
        <PageHeader
          title="Raket Market"
          description="Add only what your raket needs today."
        />
        <SetupNotice />
        <EmptyGrid />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {/* Phone and tablet stack title over meter. At desktop the meter moves
          into a right-hand column, which leaves the category strip and the
          module grid below it the full width of the page. */}
      <div className="space-y-6 lg:grid lg:grid-cols-3 lg:items-start lg:gap-8 lg:space-y-0">
        <PageHeader
          className="lg:col-span-2"
          title="Raket Market"
          description="Add only what your raket needs today."
        />
        <SlotsMeter
          className="lg:col-start-3"
          planName={plan?.name ?? "Libre"}
          activeCount={activeCount}
          slots={slots}
          left={left}
          used={used}
        />
      </div>

      <section className="space-y-3 lg:space-y-6">
        <Tabs defaultValue="all" className="gap-3 lg:gap-6">
          {/* Full-bleed scroller so the tab row never widens the page; from
              lg the strip has the whole column and simply fits. */}
          <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
            {/* The list is h-8 by default, which would crop the 44px tap
                targets phones need — hence the height override in the same
                orientation variant the list itself uses. */}
            <TabsList className="w-max group-data-[orientation=horizontal]/tabs:h-auto">
              <TabsTrigger value="all" className="h-11 px-3 lg:h-9">
                All
              </TabsTrigger>
              {categories.map((category) => (
                <TabsTrigger
                  key={category}
                  value={category}
                  className="h-11 px-3 lg:h-9"
                >
                  {categoryLabel(category)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="all">
            <ModuleGrid modules={catalog} owned={owned} />
          </TabsContent>
          {categories.map((category) => (
            <TabsContent key={category} value={category}>
              <ModuleGrid
                modules={catalog.filter((m) => m.category === category)}
                owned={owned}
              />
            </TabsContent>
          ))}
        </Tabs>
      </section>

      <section className="space-y-3 lg:space-y-4">
        <SectionHeading title="Your plan" />
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          The plan sets how many modules can run at once. Each module is then
          priced on its own ladder.
        </p>
        <PlanPicker
          plans={plans}
          currentPlanId={workspace.subscription?.plan_id ?? plan?.id ?? null}
          activeModuleCount={activeCount}
        />
      </section>
    </PageContainer>
  )
}

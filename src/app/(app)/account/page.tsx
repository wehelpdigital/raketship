import type { Metadata } from "next"
import Link from "next/link"
import { Check, LogOut } from "lucide-react"

import {
  PageContainer,
  PageHeader,
} from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import { ThemeToggle } from "@/components/shell/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ProfileForm } from "@/features/account/profile-form"
import { signOut } from "@/features/auth/actions"
import { supabaseConfigured } from "@/lib/env"
import { getPlans } from "@/lib/queries/catalog"
import { getWorkspace, type WorkspaceSummary } from "@/lib/queries/workspace"
import { getCurrentUser } from "@/lib/supabase/server"
import { cn, formatPeso } from "@/lib/utils"

export const metadata: Metadata = { title: "Account" }

const EMPTY_WORKSPACE: WorkspaceSummary = {
  profile: null,
  subscription: null,
  modules: [],
  raket: null,
}

export default async function AccountPage() {
  const user = await getCurrentUser()
  const [workspace, plans] = await Promise.all([
    user ? getWorkspace(user.id) : Promise.resolve(EMPTY_WORKSPACE),
    getPlans(),
  ])

  const plan =
    workspace.subscription?.plan ?? plans.find((p) => p.id === "free") ?? null
  const isFree = (plan?.price_centavos ?? 0) === 0
  // features is jsonb — trust the column, not the type, before rendering it.
  const rawFeatures: unknown = plan?.features
  const features = Array.isArray(rawFeatures)
    ? rawFeatures.filter((f): f is string => typeof f === "string")
    : []
  const email = workspace.profile?.email ?? user?.email ?? null

  return (
    <PageContainer>
      <PageHeader
        title="Account"
        description="Your details, your plan, and how RaketShip looks on this device."
      />

      {supabaseConfigured ? null : <SetupNotice reason="unconfigured" />}

      <Card className="sm:[--card-spacing:--spacing(5)]">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription className="text-pretty">
            This is the name that shows up on your bookings and receipts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            email={email}
            fullName={workspace.profile?.full_name ?? null}
            businessName={workspace.profile?.business_name ?? null}
            readOnly={!supabaseConfigured}
          />
        </CardContent>
      </Card>

      <Card className="sm:[--card-spacing:--spacing(5)]">
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription className="text-pretty">
            {plan?.tagline ?? "Start your raket for free"}
          </CardDescription>
          <CardAction>
            <Badge variant={isFree ? "secondary" : "default"}>
              {plan?.name ?? "Libre"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            <span className="text-lg font-semibold tracking-tight">
              {formatPeso(plan?.price_centavos ?? 0)}
            </span>{" "}
            <span className="text-muted-foreground">
              per {plan?.billing_period ?? "month"}
            </span>
          </p>

          {features.length > 0 ? (
            <ul className="space-y-3">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="text-pretty">{feature}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <Link
            href="/marketplace"
            className={cn(
              buttonVariants({ variant: isFree ? "default" : "outline" }),
              "h-11 w-full"
            )}
          >
            {isFree ? "Upgrade to Basic" : "Manage subscription"}
          </Link>
        </CardContent>
      </Card>

      <Card className="sm:[--card-spacing:--spacing(5)]">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">Theme</p>
              <p className="text-sm text-pretty text-muted-foreground">
                Light for daytime deliveries, dark for late-night encoding.
              </p>
            </div>
            <ThemeToggle className="-mr-2" />
          </div>
        </CardContent>
      </Card>

      <Card className="sm:[--card-spacing:--spacing(5)]">
        <CardHeader>
          <CardTitle>Sign out</CardTitle>
          <CardDescription className="text-pretty">
            You can come back anytime — your raket stays exactly as you left it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signOut}>
            <Button
              type="submit"
              variant="destructive"
              className="h-11 w-full gap-2"
            >
              <LogOut aria-hidden="true" />
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageContainer>
  )
}

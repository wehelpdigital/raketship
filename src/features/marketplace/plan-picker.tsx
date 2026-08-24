"use client"

import { useState, useTransition } from "react"
import { Blocks, Check, LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { changePlan } from "@/features/marketplace/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { PlanRow } from "@/lib/supabase/types"
import { cn, formatPeso } from "@/lib/utils"

/**
 * Two plans today, but the table is data-driven — three or more would leave a
 * hole in a fixed two-column grid at desktop. Static strings, since Tailwind
 * cannot see an interpolated class name.
 */
const PLAN_COLUMNS: Record<number, string> = {
  1: "sm:grid-cols-1 sm:max-w-md",
  2: "sm:grid-cols-2",
}

export interface PlanPickerProps {
  plans: PlanRow[]
  currentPlanId: string | null
  /** Used to explain why a downgrade is blocked before the user tries it. */
  activeModuleCount: number
}

export function PlanPicker({
  plans,
  currentPlanId,
  activeModuleCount,
}: PlanPickerProps) {
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (plans.length === 0) return null

  const current = plans.find((p) => p.id === currentPlanId) ?? null

  function switchTo(planId: string) {
    setPendingPlanId(planId)
    startTransition(async () => {
      const result = await changePlan(planId)
      if (result.ok) toast.success(result.message)
      else toast.error(result.message)
      setPendingPlanId(null)
    })
  }

  return (
    <div
      className={cn(
        "grid gap-3 md:gap-6",
        PLAN_COLUMNS[plans.length] ?? "sm:grid-cols-2 lg:grid-cols-3"
      )}
    >
      {plans.map((plan) => {
        const isCurrent = plan.id === currentPlanId
        const isUpgrade =
          current === null || plan.price_centavos > current.price_centavos
        const overflowing = activeModuleCount - plan.module_slots
        const blocked = !isCurrent && overflowing > 0
        const busy = pending && pendingPlanId === plan.id
        const features: string[] = (
          Array.isArray(plan.features) ? plan.features : []
        ).filter((entry): entry is string => typeof entry === "string")

        return (
          <Card
            key={plan.id}
            className={cn(
              "relative sm:[--card-spacing:--spacing(5)] lg:[--card-spacing:--spacing(6)]",
              isCurrent && "ring-2 ring-primary"
            )}
          >
            {/* A filled cap reads as "this one is yours" from across the room,
                which a 2px ring alone does not at desktop width. */}
            {isCurrent && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1.5 bg-primary"
              />
            )}

            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 lg:text-lg">
                {plan.name}
                {isCurrent && <Badge>Your plan</Badge>}
              </CardTitle>
              {plan.tagline ? (
                <CardDescription className="max-w-prose text-pretty">
                  {plan.tagline}
                </CardDescription>
              ) : null}
            </CardHeader>

            <CardContent className="flex-1 space-y-3 lg:space-y-4">
              <p>
                <span className="text-2xl font-semibold tabular-nums text-foreground lg:text-3xl">
                  {plan.price_centavos <= 0
                    ? "Free"
                    : formatPeso(plan.price_centavos)}
                </span>
                {plan.price_centavos > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {" "}
                    per {plan.billing_period}
                  </span>
                )}
              </p>

              <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                <Blocks
                  className="size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span className="text-pretty">
                  <span className="font-medium text-foreground">
                    {plan.module_slots} module
                    {plan.module_slots === 1 ? "" : "s"}
                  </span>{" "}
                  active at a time
                </span>
              </p>

              {features.length > 0 && (
                <ul className="space-y-2">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-chart-3"
                        aria-hidden="true"
                      />
                      <span className="max-w-prose text-pretty text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {blocked && (
                <p className="max-w-prose text-sm text-pretty text-muted-foreground">
                  You have {activeModuleCount} modules running. Remove{" "}
                  {overflowing} to fit on {plan.name}.
                </p>
              )}
            </CardContent>

            <CardFooter>
              <Button
                className="h-11 w-full"
                variant={isUpgrade ? "default" : "outline"}
                disabled={isCurrent || blocked || pending}
                onClick={() => switchTo(plan.id)}
              >
                {busy && (
                  <LoaderCircle
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                {isCurrent
                  ? `You're on ${plan.name}`
                  : isUpgrade
                    ? `Upgrade to ${plan.name}`
                    : `Switch to ${plan.name}`}
              </Button>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}

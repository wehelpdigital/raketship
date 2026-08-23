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
    <div className="grid gap-3 sm:grid-cols-2">
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
              "sm:[--card-spacing:--spacing(5)]",
              isCurrent && "ring-2 ring-primary"
            )}
          >
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {plan.name}
                {isCurrent && <Badge>Your plan</Badge>}
              </CardTitle>
              {plan.tagline ? (
                <CardDescription className="text-pretty">
                  {plan.tagline}
                </CardDescription>
              ) : null}
            </CardHeader>

            <CardContent className="flex-1 space-y-3">
              <p>
                <span className="text-2xl font-semibold tabular-nums text-foreground">
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
                      <span className="text-pretty text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {blocked && (
                <p className="text-sm text-pretty text-muted-foreground">
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

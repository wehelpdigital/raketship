"use client"

import { useTransition } from "react"
import { LoaderCircle, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { activateModule, deactivateModule } from "@/features/marketplace/actions"
import { Button } from "@/components/ui/button"

/**
 * The desktop rail this button sits in is only about a third of the content
 * column, and Button is `whitespace-nowrap` by default — so a long label
 * ("Delivery & Logistics is coming soon") would spill out of the card. Wrap
 * instead, with a min-height that keeps the 44px phone tap target.
 */
const CTA =
  "h-auto min-h-11 w-full py-2 text-center whitespace-normal lg:min-h-12 lg:text-base"

export interface ActivateButtonProps {
  moduleId: string
  moduleName: string
  owned: boolean
  available: boolean
}

export function ActivateButton({
  moduleId,
  moduleName,
  owned,
  available,
}: ActivateButtonProps) {
  const [pending, startTransition] = useTransition()

  function run(action: (id: string) => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action(moduleId)
      if (result.ok) toast.success(result.message)
      else toast.error(result.message)
    })
  }

  if (!available) {
    return (
      <Button className={CTA} variant="outline" disabled>
        {moduleName} is coming soon
      </Button>
    )
  }

  if (owned) {
    return (
      <Button
        className={CTA}
        variant="outline"
        disabled={pending}
        onClick={() => run(deactivateModule)}
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="size-4" aria-hidden="true" />
        )}
        Remove from my Raket
      </Button>
    )
  }

  return (
    <Button
      className={CTA}
      disabled={pending}
      onClick={() => run(activateModule)}
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Plus className="size-4" aria-hidden="true" />
      )}
      Add to my Raket
    </Button>
  )
}

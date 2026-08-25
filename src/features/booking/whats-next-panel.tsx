"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowRight, UserCheck } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { setClientManager } from "@/features/clients/actions"

/**
 * What happens after somebody books.
 *
 * A menu of follow-ons, each with its own switch. One entry today; the shape
 * is a list because the next one (payments, SMS, a thank-you later) will be a
 * sibling, not a redesign.
 */
export function WhatsNextPanel({
  clientManagerOn,
}: {
  clientManagerOn: boolean
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-pretty text-muted-foreground">
        Ito ang mga nangyayari pagkatapos mag-book ng suki. Buksan ang gusto
        mo — kusa na silang gagana sa bawat booking.
      </p>

      <ClientManagerOption initial={clientManagerOn} />
    </div>
  )
}

function ClientManagerOption({ initial }: { initial: boolean }) {
  const router = useRouter()
  const [on, setOn] = React.useState(initial)
  const [busy, startBusy] = React.useTransition()
  const id = React.useId()

  function flip(next: boolean) {
    setOn(next)
    startBusy(async () => {
      try {
        const result = await setClientManager(next)
        if (!result.ok) {
          setOn(!next)
          toast.error(result.message ?? "Hindi na-save. Pakisubukan ulit.")
          return
        }
        toast.success(result.message ?? "Tapos na.")
        router.refresh()
      } catch {
        setOn(!next)
        toast.error("Something went wrong. Pakisubukan ulit.")
      }
    })
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-chart-4/12 text-chart-4">
            <UserCheck className="size-4" aria-hidden="true" />
          </span>

          <label
            htmlFor={id}
            className="min-w-0 flex-1 cursor-pointer select-none"
          >
            <span className="block text-sm font-medium">Client Manager</span>
            <span className="block text-xs text-pretty text-muted-foreground">
              Dito naka-save ang lahat ng nag-book — pangalan, contact, at
              bawat sagot nila sa form mo, awtomatikong naka-ayos bawat tao.
            </span>
          </label>

          <Switch
            id={id}
            checked={on}
            disabled={busy}
            onCheckedChange={(next) => flip(Boolean(next))}
            aria-label="Client Manager"
          />
        </div>

        <p className="pl-12 text-xs text-pretty text-muted-foreground">
          Kapag bukas: may Client Manager sa navigation, at lalabas ito sa
          Build your Raket na nakakabit sa Booking.
        </p>

        {on ? (
          <Link
            href="/modules/client-manager"
            className="ml-12 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Buksan ang Client Manager
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        ) : null}
      </CardContent>
    </Card>
  )
}

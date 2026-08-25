"use client"

import Link from "next/link"
import { ArrowRight, UserCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

/**
 * What happens after somebody books.
 *
 * A menu of follow-ons. The switches themselves live on My raket parts now —
 * one place where every module is turned on, off and upgraded — so this tab
 * DESCRIBES what each follow-on does and points there, rather than being a
 * second lever that could disagree with the first.
 */
export function WhatsNextPanel({
  clientManagerOn,
}: {
  clientManagerOn: boolean
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-pretty text-muted-foreground">
        Ito ang mga nangyayari pagkatapos mag-book ng suki. Ang pag-on at
        pag-off ay nasa My raket parts.
      </p>

      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-chart-4/12 text-chart-4">
              <UserCheck className="size-4" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="text-sm font-medium">Client Manager</p>
                {clientManagerOn ? (
                  <Badge className="font-normal">Bukas</Badge>
                ) : (
                  <Badge variant="outline" className="font-normal">
                    Sarado
                  </Badge>
                )}
              </div>
              <p className="text-xs text-pretty text-muted-foreground">
                Dito naka-save ang lahat ng nag-book — pangalan, contact, at
                bawat sagot nila sa form mo, awtomatikong naka-ayos bawat tao.
              </p>
            </div>
          </div>

          <p className="pl-12 text-xs text-pretty text-muted-foreground">
            Kapag bukas: may Client Manager sa navigation, at lalabas ito sa
            Build your Raket na nakakabit sa Booking.
          </p>

          <Link
            href={clientManagerOn ? "/modules/client-manager" : "/raket/parts"}
            className="ml-12 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {clientManagerOn
              ? "Buksan ang Client Manager"
              : "Buksan sa My raket parts"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

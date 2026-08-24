import { MapPin } from "lucide-react"

import { ContactChips } from "@/features/business/contact-chips"
import { landmarkLine } from "@/lib/business/address"
import type { BusinessProfileRow } from "@/lib/supabase/types"

export interface BusinessFooterProps {
  business: BusinessProfileRow | null
}

/**
 * How to reach the shop and where it is — under the wizard rather than above
 * it, because the booking is what the visitor came for.
 *
 * Everything here is optional and the whole block disappears when nothing has
 * been filled in.
 */
export function BusinessFooter({ business }: BusinessFooterProps) {
  if (!business) return null

  const chat = business.chat_apps ?? []
  const mobile = business.mobile_number?.trim() || null
  /*
    The one-line address is printed in the header now, so only the directions
    are left down here. They are gated on the same setting, because "katapat ng
    Mercury Drug, kulay dilaw na gate" locates a house as precisely as a street
    number does.
  */
  const landmark = landmarkLine(business)

  const hasContact =
    mobile || business.facebook_url || business.instagram_handle || business.website_url
  const hasPlace = landmark !== null

  if (!hasContact && !hasPlace) return null

  return (
    <div className="mt-6 space-y-3">
      {hasContact ? (
        <Panel title="Makipag-ugnayan">
          <ContactChips
            mobile={mobile}
            chatApps={chat}
            facebookUrl={business.facebook_url}
            instagramHandle={business.instagram_handle}
            websiteUrl={business.website_url}
          />
        </Panel>
      ) : null}

      {hasPlace ? (
        <Panel title="Paano pumunta">
          {/* Directions run to a sentence, so they keep their own block and
              their line breaks rather than being folded onto the address. */}
          <p className="flex items-start gap-2 text-sm">
            <MapPin
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="whitespace-pre-line text-pretty text-muted-foreground">
              {landmark}
            </span>
          </p>
        </Panel>
      ) : null}
    </div>
  )
}

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-border sm:p-5">
      <h2 className="mb-2.5 text-sm font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}



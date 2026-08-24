import { AtSign, Globe, MapPin, MessageCircle, Phone, Users } from "lucide-react"

import { landmarkLine } from "@/lib/business/address"
import { toInternational } from "@/lib/business/contact"
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
          <div className="flex flex-wrap gap-2">
            {mobile ? (
              <Chip href={`tel:${mobile}`} icon={Phone}>
                {mobile}
              </Chip>
            ) : null}

            {/*
              These reuse the number already given rather than asking for it a
              second time. Viber's scheme takes the international form, so the
              stored 09xx is converted here rather than stored twice.
            */}
            {mobile && chat.includes("viber") ? (
              <Chip href={`viber://chat?number=${toInternational(mobile)}`} icon={MessageCircle}>
                Viber
              </Chip>
            ) : null}
            {mobile && chat.includes("whatsapp") ? (
              <Chip href={`https://wa.me/${toInternational(mobile).replace("+", "")}`} icon={MessageCircle}>
                WhatsApp
              </Chip>
            ) : null}
            {mobile && chat.includes("telegram") ? (
              <Chip href={`https://t.me/${toInternational(mobile)}`} icon={MessageCircle}>
                Telegram
              </Chip>
            ) : null}

            {business.facebook_url ? (
              <Chip href={business.facebook_url} icon={Users}>
                Facebook
              </Chip>
            ) : null}
            {business.instagram_handle ? (
              <Chip
                href={`https://instagram.com/${business.instagram_handle}`}
                icon={AtSign}
              >
                @{business.instagram_handle}
              </Chip>
            ) : null}
            {business.website_url ? (
              <Chip href={business.website_url} icon={Globe}>
                Website
              </Chip>
            ) : null}
          </div>
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

function Chip({
  href,
  icon: Icon,
  children,
}: {
  href: string
  icon: typeof Phone
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="inline-flex h-11 max-w-full items-center gap-2 rounded-full bg-muted/60 px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </a>
  )
}


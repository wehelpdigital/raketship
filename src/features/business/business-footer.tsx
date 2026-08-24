import { AtSign, Globe, MapPin, MessageCircle, Phone, Users } from "lucide-react"

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
  const address = addressLine(business)
  /*
    The landmark is gated on the SAME setting as the address, not shown beside
    it. "Katapat ng Mercury Drug, kulay dilaw na gate" locates a house as
    precisely as a street number does — printing it while the address is hidden
    would defeat the setting for the exact person it exists to protect.
  */
  const landmark =
    business.address_visibility === "hidden"
      ? null
      : business.landmark?.trim() || null

  const hasContact =
    mobile || business.facebook_url || business.instagram_handle || business.website_url
  const hasPlace = address || landmark

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
        <Panel title="Saan kayo">
          <div className="space-y-1.5 text-sm">
            {address ? (
              <Row icon={MapPin} label="Address">
                {address}
              </Row>
            ) : null}
            {landmark ? (
              // Directions run to a sentence here, so this keeps its own line
              // and its line breaks rather than being folded into the address.
              <p className="whitespace-pre-line text-pretty text-muted-foreground">
                {landmark}
              </p>
            ) : null}
          </div>
        </Panel>
      ) : null}
    </div>
  )
}

/**
 * The address, cut to what the owner agreed to publish.
 *
 * "hidden" returns nothing at all, and "area" drops the street — a freelancer
 * working from a bedroom must be able to fill the address in for their own
 * records without it appearing on a page anyone can open.
 */
export function addressLine(business: BusinessProfileRow): string | null {
  if (business.address_visibility === "hidden") return null

  const parts =
    business.address_visibility === "full"
      ? [
          business.street_address,
          business.barangay,
          business.city,
          business.province,
        ]
      : [business.barangay, business.city, business.province]

  const line = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ")

  return line.length > 0 ? line : null
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

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Phone
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <span className="sr-only">{label}: </span>
        <span className="text-pretty">{children}</span>
      </div>
    </div>
  )
}

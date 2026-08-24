import { AtSign, Globe, MessageCircle, Phone, Users } from "lucide-react"

import { toInternational } from "@/lib/business/contact"
import { cn } from "@/lib/utils"

export interface ContactChipsProps {
  mobile: string | null
  /** Which apps that same number can also be reached on. */
  chatApps: readonly string[]
  facebookUrl: string | null
  instagramHandle: string | null
  websiteUrl: string | null
  className?: string
}

/**
 * Whether there is any way at all to reach this shop.
 *
 * Exported so a caller can decide whether to write a heading above the chips:
 * an invitation to message with nothing to message is worse than silence.
 */
export function hasAnyContact(contact: {
  mobile: string | null
  facebookUrl: string | null
  instagramHandle: string | null
  websiteUrl: string | null
}): boolean {
  return Boolean(
    contact.mobile?.trim() ||
      contact.facebookUrl ||
      contact.instagramHandle ||
      contact.websiteUrl
  )
}

/**
 * Every way a suki can reach this shop, as tap targets.
 *
 * No hooks and no client directive, so the same component serves the public
 * page's footer, which is a Server Component, and the booking confirmation,
 * which is inside a client tree. Two implementations would eventually offer
 * different ways to reach the same business.
 *
 * Renders nothing at all when the owner has filled none of it in, so callers
 * do not each need to work out whether there is anything to show.
 */
export function ContactChips({
  mobile,
  chatApps,
  facebookUrl,
  instagramHandle,
  websiteUrl,
  className,
}: ContactChipsProps) {
  const number = mobile?.trim() || null
  if (!hasAnyContact({ mobile, facebookUrl, instagramHandle, websiteUrl })) {
    return null
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {number ? (
        <Chip href={`tel:${number}`} icon={Phone}>
          {number}
        </Chip>
      ) : null}

      {/* These reuse the number already given rather than asking for it a
          second time. Viber's scheme wants the international form. */}
      {number && chatApps.includes("viber") ? (
        <Chip href={`viber://chat?number=${toInternational(number)}`} icon={MessageCircle}>
          Viber
        </Chip>
      ) : null}
      {number && chatApps.includes("whatsapp") ? (
        <Chip
          href={`https://wa.me/${toInternational(number).replace("+", "")}`}
          icon={MessageCircle}
        >
          WhatsApp
        </Chip>
      ) : null}
      {number && chatApps.includes("telegram") ? (
        <Chip href={`https://t.me/${toInternational(number)}`} icon={MessageCircle}>
          Telegram
        </Chip>
      ) : null}

      {facebookUrl ? (
        <Chip href={facebookUrl} icon={Users}>
          Facebook
        </Chip>
      ) : null}
      {instagramHandle ? (
        <Chip href={`https://instagram.com/${instagramHandle}`} icon={AtSign}>
          @{instagramHandle}
        </Chip>
      ) : null}
      {websiteUrl ? (
        <Chip href={websiteUrl} icon={Globe}>
          Website
        </Chip>
      ) : null}
    </div>
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
  const external = href.startsWith("http")
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="inline-flex h-11 max-w-full items-center gap-2 rounded-full bg-muted/60 px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </a>
  )
}

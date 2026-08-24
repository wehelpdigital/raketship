import { Clock, Globe, MapPin } from "lucide-react"

import { LogoMask } from "@/features/business/logo-mask"
import { addressLine } from "@/lib/business/address"
import { mediaUrl } from "@/lib/business/media"
import type { BusinessProfileRow } from "@/lib/supabase/types"

export interface BusinessHeaderProps {
  business: BusinessProfileRow | null
  /** Used when the business has no name of its own yet. */
  fallbackName: string
  /** What is being booked, when that is not simply the business's own name. */
  bookingName?: string | null
  /** "30 min", or "3 serbisyo" when there is a catalogue. */
  timeLabel: string
  /** "Manila · GMT+8". */
  zoneLabel: string
}

/**
 * The shopfront at the top of a public booking link.
 *
 * A photo on the left, and beside it the things a suki needs before deciding:
 * who this is, what they are booking, how long it takes and where it is. One
 * block rather than the two stacked ones that were here — a banner and then a
 * separate heading meant the useful facts started a screen down on a phone.
 *
 * The cover photo is deliberately not here. It was a 3:1 band above all of
 * this, so on a 390px screen it pushed the name, the length and the address
 * below the fold to show a picture that answers none of those questions.
 *
 * The address goes through addressLine(), so it is cut to whatever the owner
 * agreed to publish and vanishes entirely when they chose "hidden".
 */
export function BusinessHeader({
  business,
  fallbackName,
  bookingName,
  timeLabel,
  zoneLabel,
}: BusinessHeaderProps) {
  const logo = mediaUrl(business?.logo_path)
  const name = business?.business_name?.trim() || fallbackName
  const tagline = business?.tagline?.trim() || null
  const location = business ? addressLine(business) : null

  // Only worth a line when it is not the same thing said twice.
  const booking =
    bookingName && bookingName.trim() && bookingName.trim() !== name
      ? bookingName.trim()
      : null

  return (
    <header className="mb-6 lg:mb-8">
      {/*
        Centred, not top-aligned. The photo is 64px (80 at sm) and a column of
        just a name and one meta row is about 50 — so top-aligning them left the
        photo hanging below the text it was meant to sit beside. Centring lines
        up whichever is shorter against the taller one, which is right whether
        the business filled in a tagline and an address or nothing at all.
      */}
      <div className="flex items-center gap-4 sm:gap-5">
        <LogoMask
          url={logo}
          name={name}
          crop={{
            zoom: business?.logo_zoom ?? 1,
            x: business?.logo_x ?? 50,
            y: business?.logo_y ?? 50,
          }}
          className="size-16 text-lg sm:size-20 sm:text-xl"
          textClassName="text-lg sm:text-xl"
        />

        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl lg:text-3xl">
            {name}
          </h1>

          {booking ? (
            <p className="text-sm font-medium text-pretty sm:text-base">
              {booking}
            </p>
          ) : null}

          {tagline ? (
            <p className="text-sm text-pretty text-muted-foreground">{tagline}</p>
          ) : null}

          {/* The facts that decide whether someone books at all. Kept to a
              wrapping row so they cost as little vertical space as possible. */}
          <div className="space-y-1 pt-0.5">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4 shrink-0" aria-hidden="true" />
                {timeLabel}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Globe className="size-4 shrink-0" aria-hidden="true" />
                {zoneLabel}
              </span>
            </p>

            {location ? (
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="text-pretty">{location}</span>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}

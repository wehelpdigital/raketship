import type { ImageCrop } from "@/lib/business/crop"
import { mediaUrl } from "@/lib/business/media"
import { t, type Locale } from "@/lib/i18n"
import type { BusinessProfileRow } from "@/lib/supabase/types"

/**
 * What a module card on the outer canvas says about itself.
 *
 * The canvas used to draw every module as the same white card with a stock
 * sentence, which made the page a diagram of what COULD run rather than a
 * picture of what IS running. A glance is the module's own numbers and marks,
 * assembled on the server where the data already is — the client just paints
 * strings.
 */
export interface ModuleGlance {
  /** Short facts, already worded in the right language, top first. */
  lines: string[]
  /** Something of this module is reachable by the public right now. */
  live: boolean
  /**
   * The owner's own sentence about the shop, allowed a second line.
   *
   * Facts truncate; a tagline cut mid-word reads as a mistake, because it is
   * prose someone wrote.
   */
  tagline?: string | null
  /** The shop's logo, framed the way the owner framed it. */
  logoUrl?: string | null
  logoCrop?: Partial<ImageCrop> | null
  /** The shop's NAME — LogoMask derives the initials and the alt text. */
  logoName?: string | null
}

export interface BookingGlanceCounts {
  calendars: number
  published: number
  upcoming: number
}

/** The Booking card: how many calendars, how many live, what is coming. */
export function bookingGlance(
  counts: BookingGlanceCounts,
  locale: Locale
): ModuleGlance {
  if (counts.calendars === 0) {
    return { lines: [t(locale, "raket.booking.noCalendars")], live: false }
  }

  const calendars = t(
    locale,
    counts.calendars === 1
      ? "raket.booking.calendars.one"
      : "raket.booking.calendars.many",
    { n: counts.calendars }
  )
  const state =
    counts.published > 0
      ? t(locale, "raket.booking.live", { n: counts.published })
      : t(locale, "raket.booking.draft")

  const upcoming =
    counts.upcoming === 0
      ? t(locale, "raket.booking.upcoming.none")
      : t(
          locale,
          counts.upcoming === 1
            ? "raket.booking.upcoming.one"
            : "raket.booking.upcoming.many",
          { n: counts.upcoming }
        )

  return {
    lines: [`${calendars} · ${state}`, upcoming],
    live: counts.published > 0,
  }
}

/** The Your Business card: the shop as the owner dressed it. */
export function businessGlance(
  profile: BusinessProfileRow | null,
  locale: Locale
): ModuleGlance {
  if (!profile || !profile.business_name?.trim()) {
    return { lines: [t(locale, "raket.business.unset")], live: false }
  }

  return {
    // The name is the card's TITLE (the page promotes it there), so the lines
    // carry only what the title does not: the owner's own tagline.
    lines: [],
    tagline: profile.description?.trim() || null,
    // The profile page only opens to the public alongside a live calendar,
    // so "live" is the Booking card's fact to state, not this one's.
    live: false,
    logoUrl: mediaUrl(profile.logo_path),
    logoCrop: {
      zoom: profile.logo_zoom ?? 1,
      x: profile.logo_x ?? 50,
      y: profile.logo_y ?? 50,
    },
    logoName: profile.business_name,
  }
}

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
  /** Things waiting on the owner — worn as a count in the card's corner. */
  count?: number
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

/**
 * The Booking card: nothing but the number that matters.
 *
 * The stat lines this used to write — calendars, live, upcoming — were the
 * app reading its own dashboard out loud. What an owner acts on is bookings
 * still to come, and a count in the corner says that without a sentence.
 */
export function bookingGlance(upcoming: number): ModuleGlance {
  return { lines: [], count: upcoming }
}

/** The Your Business card: the shop as the owner dressed it. */
export function businessGlance(
  profile: BusinessProfileRow | null,
  locale: Locale
): ModuleGlance {
  if (!profile || !profile.business_name?.trim()) {
    return { lines: [t(locale, "raket.business.unset")] }
  }

  return {
    // The name is the card's TITLE (the page promotes it there), so the lines
    // carry only what the title does not: the owner's own tagline.
    lines: [],
    tagline: profile.description?.trim() || null,
    logoUrl: mediaUrl(profile.logo_path),
    logoCrop: {
      zoom: profile.logo_zoom ?? 1,
      x: profile.logo_x ?? 50,
      y: profile.logo_y ?? 50,
    },
    logoName: profile.business_name,
  }
}

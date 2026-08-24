/**
 * The timezone list, shared by the owner's availability editor and the public
 * booking page.
 *
 * It lives here rather than in either component because the public page must
 * not pull the editor into its bundle — that page is the one strangers load,
 * often on a phone, often on mobile data.
 */

export const DEFAULT_TIMEZONE = "Asia/Manila"
export const DEFAULT_COUNTRY = "PH"

/**
 * Intl.supportedValuesOf is missing from older runtimes and from some test
 * environments, so this shortlist is the floor, never the whole list.
 */
export const FALLBACK_TIMEZONES = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
]

function readSupportedTimezones(): string[] {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      const zones = Intl.supportedValuesOf("timeZone")
      if (Array.isArray(zones) && zones.length > 0) return zones
    }
  } catch {
    // Older runtime, or a locked-down one. The fallback below is enough.
  }
  return []
}

export const ALL_TIMEZONES: string[] = Array.from(
  new Set([...readSupportedTimezones(), ...FALLBACK_TIMEZONES])
).sort((a, b) => a.localeCompare(b))

/** Whether a zone is one this runtime can actually format in. */
export function isKnownTimezone(zone: string): boolean {
  if (!zone) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/** "Asia/Manila" -> "Manila", for a label a customer can read at a glance. */
export function zoneCity(zone: string): string {
  return zone.split("/").pop()?.replace(/_/g, " ") ?? zone
}

/**
 * A list that always contains the zones that matter, whatever the runtime
 * knows: the calendar's own zone and the viewer's, even if either is missing
 * from Intl's list.
 */
export function timezoneChoices(...ensure: (string | null | undefined)[]): string[] {
  const extra = ensure.filter(
    (zone): zone is string => typeof zone === "string" && zone.length > 0
  )
  return Array.from(new Set([...ALL_TIMEZONES, ...extra])).sort((a, b) =>
    a.localeCompare(b)
  )
}

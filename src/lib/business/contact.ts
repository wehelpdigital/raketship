/**
 * Tidying up what people type into contact boxes.
 *
 * Pure, and deliberately outside the server-action module: a "use server" file
 * may only export async functions, and these are also the parts most worth
 * testing on their own.
 *
 * Everything here NORMALISES rather than merely accepting. A number written
 * three different ways is three different rows to a database and one shop to a
 * customer, and the customer is right.
 */

/**
 * Philippine mobile numbers, written the ways people actually type them:
 * 09171234567, +639171234567, 639171234567, 9171234567, with or without
 * spaces, dashes or brackets. Returns the 09XXXXXXXXX form, or null.
 */
export function normalisePhMobile(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "").replace(/^\+/, "")
  if (/^09\d{9}$/.test(digits)) return digits
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`
  if (/^9\d{9}$/.test(digits)) return `0${digits}`
  return null
}

/** 09171234567 -> +639171234567, which is what the chat-app schemes expect. */
export function toInternational(mobile: string): string {
  const digits = mobile.replace(/\D/g, "")
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`
  if (/^639\d{9}$/.test(digits)) return `+${digits}`
  return `+${digits}`
}

/**
 * A URL we are willing to put behind a link.
 *
 * People paste "facebook.com/shop" far more often than they type the scheme,
 * so a missing one is added rather than rejected. Anything that is not http(s)
 * is refused: a javascript: or data: URL in an anchor on a public page is an
 * XSS vector, not a typo.
 */
export function tidyUrl(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  // Tested BEFORE prefixing, so "javascript:alert(1)" cannot be rescued into
  // "https://javascript:alert(1)" and slip through as a valid URL.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return null

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    // A hostname with no dot is not a site anyone can reach.
    if (!url.hostname.includes(".")) return null
    return url.toString()
  } catch {
    return null
  }
}

/**
 * "@aling.nena", "aling.nena" or a full profile URL, stored as the bare handle.
 * A handle is shorter to type on a phone than a URL and cannot be pasted broken.
 */
export function tidyHandle(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  const fromUrl = /(?:instagram\.com|tiktok\.com)\/@?([A-Za-z0-9._]+)/i.exec(raw)
  const handle = (fromUrl?.[1] ?? raw).replace(/^@+/, "").trim()
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null
  return handle
}

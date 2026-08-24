/**
 * Public booking links look like /book/aling-nena-haircut, so slugs need to be
 * URL-safe, readable, and stable enough that a printed QR code keeps working.
 */

const RESERVED = new Set([
  "new",
  "edit",
  "admin",
  "api",
  "book",
  "settings",
  "login",
  "register",
  "dashboard",
  "account",
  "raket",
  "marketplace",
  "modules",
])

export const SLUG_MIN = 3
export const SLUG_MAX = 48

/** Best-effort slug from free text. May return "" for input with no letters. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    // Strip accents so "Piña" becomes "pina" rather than losing the letter.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "")
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug.toLowerCase())
}

/** Returns an error message, or null when the slug is usable. */
export function validateSlug(slug: string): string | null {
  const value = slug.trim().toLowerCase()
  if (value.length < SLUG_MIN) {
    return `Links need at least ${SLUG_MIN} characters.`
  }
  if (value.length > SLUG_MAX) {
    return `Links can be at most ${SLUG_MAX} characters.`
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return "Use lowercase letters, numbers and single dashes only."
  }
  if (isReservedSlug(value)) {
    return "That word is reserved. Try adding your business name."
  }
  return null
}

/**
 * A slug that avoids the ones already taken, by appending -2, -3, …
 * The database still holds the unique index; this only spares the user a
 * pointless round-trip on the obvious collisions.
 */
export function uniqueSlug(base: string, taken: readonly string[]): string {
  const seed = slugify(base) || "booking"
  const used = new Set(taken.map((t) => t.toLowerCase()))
  if (!used.has(seed) && !isReservedSlug(seed)) return seed

  for (let i = 2; i < 1000; i++) {
    const candidate = `${seed.slice(0, SLUG_MAX - 5)}-${i}`
    if (!used.has(candidate)) return candidate
  }
  return `${seed.slice(0, SLUG_MAX - 7)}-${Date.now().toString(36).slice(-4)}`
}

/** The full public URL for a slug. */
export function bookingUrl(slug: string, origin: string): string {
  return `${origin.replace(/\/+$/, "")}/book/${slug}`
}

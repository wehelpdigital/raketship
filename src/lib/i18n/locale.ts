/**
 * Which language the app is speaking.
 *
 * Filipino is the default and always will be: this is built for raketeros, and
 * an English-first app would be asking them to translate their own tools. The
 * English side exists because half the vocabulary of running a small business
 * here is already English, and because some people simply read it faster.
 *
 * The choice lives in a plain cookie rather than in the URL. A raketero pastes
 * their booking link into Facebook; a /en/ or /fil/ in that link would fork
 * every share into two, and the wrong half would eventually be the one that
 * spread.
 */

export const LOCALES = ["fil", "en"] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "fil"

/** Not HttpOnly on purpose — the toggle sets it in the browser. */
export const LOCALE_COOKIE = "raketship-locale"

/** A year: the choice is a preference, not a session. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const LOCALE_LABELS: Record<Locale, string> = {
  fil: "Filipino",
  en: "English",
}

/**
 * Anything that is not a locale we ship becomes the default.
 *
 * A cookie is a claim, not a fact — it survives redeploys, it can be edited by
 * hand, and it can name a language that used to exist. Falling back is what
 * keeps a removed locale from blanking the app for everyone who chose it.
 */
export function normaliseLocale(value: string | null | undefined): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE
}

export function isLocale(value: string): value is Locale {
  return LOCALES.includes(value as Locale)
}

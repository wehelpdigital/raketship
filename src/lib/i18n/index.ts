import { booked } from "@/lib/i18n/messages/booked"
import { dates } from "@/lib/i18n/messages/dates"
import { shell } from "@/lib/i18n/messages/shell"
import { fill, type MessageParams } from "@/lib/i18n/dictionary"
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale"

export const MESSAGES = {
  ...shell,
  ...dates,
  ...booked,
}

export type MessageKey = keyof typeof MESSAGES

/**
 * One message, in one language.
 *
 * A key that does not exist comes back as the key itself. That is deliberate:
 * a visible "booked.fact.nmae" on the page is a bug somebody fixes in a
 * minute, where an empty string is a blank box nobody can explain.
 */
export function t(
  locale: Locale,
  key: MessageKey,
  params?: MessageParams
): string {
  const message = MESSAGES[key]
  if (!message) return key
  return fill(message[locale] ?? message[DEFAULT_LOCALE], params)
}

/** The shape components hold: bind the language once, then just name keys. */
export type Translate = (key: MessageKey, params?: MessageParams) => string

export function translator(locale: Locale): Translate {
  return (key, params) => t(locale, key, params)
}

export {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_LABELS,
  LOCALES,
  normaliseLocale,
  type Locale,
} from "@/lib/i18n/locale"
export type { Message, MessageParams } from "@/lib/i18n/dictionary"

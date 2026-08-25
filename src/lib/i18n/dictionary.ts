import type { Locale } from "@/lib/i18n/locale"

/**
 * One message, in every language the app speaks.
 *
 * Both languages sit on the same line on purpose. A dictionary split into a
 * fil file and an en file drifts the first time somebody adds a string in a
 * hurry, and the half that is missing is always the one nobody is looking at.
 * Here the type will not let a message exist in one language only.
 */
export type Message = Record<Locale, string>

export type Dict = Record<string, Message>

/**
 * Values a message can take.
 *
 * Numbers arrive as numbers so a message can decide how to write them — the
 * Filipino side spells small counts out, the English side does not.
 */
export type MessageParams = Record<string, string | number>

/**
 * Fills {name} placeholders.
 *
 * A placeholder with no value is left standing rather than replaced with
 * "undefined": a visible {name} on the page is a bug report, and "undefined"
 * is a bug that ships.
 */
export function fill(template: string, params?: MessageParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in params ? String(params[key]) : whole
  )
}

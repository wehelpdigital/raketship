import "server-only"

import { cookies } from "next/headers"

import { translator, type Translate } from "@/lib/i18n"
import { LOCALE_COOKIE, normaliseLocale, type Locale } from "@/lib/i18n/locale"

/**
 * The language this request is being answered in.
 *
 * Read from the cookie on the server so the first byte is already in the right
 * language — a page that renders in Filipino and then flips to English after
 * hydration is worse than one that never offered the choice.
 *
 * cookies() is a Promise in Next 16.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  return normaliseLocale(store.get(LOCALE_COOKIE)?.value)
}

/** getLocale() and translator() in one, for server components. */
export async function getT(): Promise<Translate> {
  return translator(await getLocale())
}

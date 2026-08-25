"use client"

import * as React from "react"

import { translator, type Translate } from "@/lib/i18n"
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale"

/**
 * The language, handed down from the server render.
 *
 * Client components cannot read the cookie before they hydrate without
 * flickering, and there is no second source of truth here: the layout read it
 * once, server-side, and everything below is told.
 */
const LocaleContext = React.createContext<Locale>(DEFAULT_LOCALE)

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale
  children: React.ReactNode
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  )
}

export function useLocale(): Locale {
  return React.useContext(LocaleContext)
}

/**
 * The translate function, memoised per language.
 *
 * Without the memo every render hands children a new function identity, which
 * is exactly the sort of thing that quietly defeats memoisation further down.
 */
export function useT(): Translate {
  const locale = useLocale()
  return React.useMemo(() => translator(locale), [locale])
}

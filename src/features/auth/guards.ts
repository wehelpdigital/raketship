import { env } from "@/lib/env"

const DEFAULT_NEXT = "/dashboard"
const MAX_NOTICE = 180

/**
 * Only same-origin paths may come back from a form field or a query string.
 * A bare `startsWith("/")` is not enough: browsers read `/\host` the same way
 * they read `//host`, and they strip tabs and newlines before parsing, so
 * `/<tab>/host` becomes protocol-relative too.
 */
export function safeNextPath(
  value: FormDataEntryValue | string | null | undefined,
  fallback: string = DEFAULT_NEXT
): string {
  if (typeof value !== "string") return fallback
  const raw = value.replace(/[\t\n\r]/g, "").trim()
  if (!raw.startsWith("/")) return fallback
  if (/^\/[/\\]/.test(raw)) return fallback
  return raw
}

/** First value of a `searchParams` entry, which Next may hand over as an array. */
export function firstParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * The OAuth callback hands messages back through the query string, so anyone
 * can craft a link. Keep whatever arrives short and single-line.
 */
export function tidyNotice(
  value: string | string[] | undefined
): string | undefined {
  const raw = firstParam(value)?.replace(/\s+/g, " ").trim()
  if (!raw) return undefined
  return raw.length > MAX_NOTICE ? `${raw.slice(0, MAX_NOTICE - 1)}…` : raw
}

/**
 * The demo shortcut signs whoever clicks it in as the seeded admin, so on a
 * deployed build it has to be asked for by name rather than merely not
 * switched off.
 */
export function demoLoginVisible(): boolean {
  if (!env.demoLoginEnabled) return false
  if (process.env.NODE_ENV !== "production") return true
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true"
}

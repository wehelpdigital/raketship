/**
 * Centralised environment access.
 *
 * The app must still *render* when Supabase is unconfigured — we show a setup
 * screen instead of crashing the whole tree — so reads are tolerant and
 * `supabaseConfigured` is the single source of truth for "can we talk to the DB".
 */

function readPublic(name: string, fallback = ""): string {
  // Next.js inlines process.env.NEXT_PUBLIC_* at build time, so these must be
  // referenced as full static property accesses rather than dynamic lookups.
  const map: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_ENABLE_DEMO_LOGIN: process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN,
  }
  return (map[name] ?? fallback).trim()
}

export const env = {
  supabaseUrl: readPublic("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: readPublic("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  siteUrl: readPublic("NEXT_PUBLIC_SITE_URL", "http://localhost:3000"),
  /**
   * Opt-IN, not opt-out. The demo shortcut signs anyone in as the seeded admin,
   * so an unset variable must mean "off" — otherwise deploying with
   * DEMO_ADMIN_* configured silently hands the account to every visitor.
   * Development keeps it on for convenience.
   */
  demoLoginEnabled:
    process.env.NODE_ENV === "production"
      ? readPublic("NEXT_PUBLIC_ENABLE_DEMO_LOGIN") === "true"
      : readPublic("NEXT_PUBLIC_ENABLE_DEMO_LOGIN") !== "false",
} as const

/** True when both the URL and a browser key are present. */
export const supabaseConfigured =
  env.supabaseUrl.length > 0 && env.supabasePublishableKey.length > 0

/** Server-only. Throws if read from the browser bundle. */
export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not be called in the browser")
  }
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
    secretKey: process.env.SUPABASE_SECRET_KEY?.trim() ?? "",
    demoAdminEmail: process.env.DEMO_ADMIN_EMAIL?.trim() ?? "admin@raketship.ph",
    demoAdminPassword: process.env.DEMO_ADMIN_PASSWORD?.trim() ?? "",
  }
}

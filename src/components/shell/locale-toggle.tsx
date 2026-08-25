"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  PhilippinesFlag,
  UnitedStatesFlag,
} from "@/components/shell/flag-icons"
import { useLocale, useT } from "@/components/shell/locale-provider"
import { Button } from "@/components/ui/button"
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/**
 * Which language the app is speaking, and the way to change it.
 *
 * Shows the language you are IN, like the moon beside it shows the mode you
 * are in, and says what tapping does in its label.
 *
 * The cookie is written here rather than through a server action. A server
 * action would be a round trip before anything could change, and the very next
 * thing that happens is a round trip anyway — router.refresh() re-renders the
 * server components, which read the cookie this just set. One trip, not two.
 */
export function LocaleToggle({ className }: { className?: string }) {
  const locale = useLocale()
  const t = useT()
  const router = useRouter()
  const [, startSwitching] = React.useTransition()

  const next: Locale = locale === "fil" ? "en" : "fil"

  function choose() {
    document.cookie = [
      `${LOCALE_COOKIE}=${next}`,
      "path=/",
      `max-age=${LOCALE_COOKIE_MAX_AGE}`,
      "samesite=lax",
    ].join("; ")
    startSwitching(() => router.refresh())
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t("shell.language.switchTo")}
      title={t("shell.language.switchTo")}
      className={cn("size-11 shrink-0 rounded-lg", className)}
      onClick={choose}
    >
      <span className="block w-5 overflow-hidden rounded-[3px] ring-1 ring-border">
        {locale === "fil" ? (
          <PhilippinesFlag className="block w-full" />
        ) : (
          <UnitedStatesFlag className="block w-full" />
        )}
      </span>
    </Button>
  )
}

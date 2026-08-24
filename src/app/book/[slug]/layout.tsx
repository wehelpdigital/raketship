import type { ReactNode } from "react"
import Link from "next/link"
import { Rocket } from "lucide-react"

import { ThemeToggle } from "@/components/shell/theme-toggle"

/**
 * The public booking route runs outside the app shell — no sidebar, no tab bar,
 * no account menu. A customer arriving from a pasted Messenger link has no
 * account and nothing to navigate to, so the only chrome is a mark saying where
 * they are and a line saying who built it.
 */
export default function PublicBookingLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border bg-background/95 pt-safe backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-xl items-center px-4 sm:px-6 lg:h-16 lg:max-w-2xl lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Rocket className="size-4" aria-hidden />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              RaketShip
            </span>
          </Link>

          {/* A customer may open this link at any hour; let them read it in
              whichever mode suits. */}
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border pb-safe">
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-1 px-4 py-6 text-center sm:px-6 lg:max-w-2xl lg:px-8">
          <p className="text-xs text-muted-foreground">
            Powered by{" "}
            <Link
              href="/"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              RaketShip
            </Link>
          </p>
          <p className="text-[11px] text-muted-foreground">
            Booking links para sa mga raketero.
          </p>
        </div>
      </footer>
    </div>
  )
}

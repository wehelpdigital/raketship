import type { ReactNode } from "react"
import Link from "next/link"
import { Boxes, Rocket, Sparkles, TrendingUp } from "lucide-react"

import { cn } from "@/lib/utils"

const BRAND_POINTS = [
  {
    icon: Sparkles,
    // Static class strings on purpose — an interpolated `bg-${tone}` would be
    // invisible to the Tailwind scanner.
    tone: "bg-chart-1/12 text-chart-1",
    title: "Start free",
    body: "Make an account, set up your first raket, and pay nothing while you find your footing.",
  },
  {
    icon: Boxes,
    tone: "bg-chart-3/12 text-chart-3",
    title: "Add only the modules you need",
    body: "Booking, invoices, a customer list — take them from the marketplace one at a time.",
  },
  {
    icon: TrendingUp,
    tone: "bg-chart-2/15 text-chart-2",
    title: "Upgrade tingi style",
    body: "Every module has its own ladder. Move up a notch when the raket grows, hindi lahat-lahat.",
  },
] as const

interface AuthShellProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

/**
 * The form column. Phone gets a narrow centred card; from `md` it widens and
 * the type steps up, and that larger scale carries into the desktop split laid
 * out by `(auth)/layout.tsx`, where this sits in the right-hand half.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  className,
}: AuthShellProps) {
  return (
    <div
      className={cn(
        "relative isolate w-full max-w-sm space-y-6 md:max-w-md md:space-y-7",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-48 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/2 -z-10 h-40 w-64 -translate-x-1/2 rounded-full bg-chart-2/10 blur-3xl"
      />

      <header className="space-y-3 text-center lg:text-left">
        {/* The brand panel carries the mark from `lg` up, so this stays a
            phone/tablet-only way back to the marketing root. */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Rocket className="size-4" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold tracking-tight">RaketShip</span>
        </Link>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance lg:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-muted-foreground text-pretty md:text-base">
              {subtitle}
            </p>
          ) : null}
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 md:p-6">
        {children}
      </div>

      {footer ? <div className="space-y-6">{footer}</div> : null}
    </div>
  )
}

/**
 * The tablet band. Below `md` the phone screen stays a single lean card and
 * this is absent; from `lg` the brand panel says the same things with more
 * room, so it hides again. In between it turns the empty half of an 834px
 * screen into a three-up row instead of margin.
 */
export function AuthHighlights() {
  return (
    <ul className="hidden w-full max-w-2xl gap-5 border-t border-border pt-8 md:grid md:grid-cols-3 lg:hidden">
      {BRAND_POINTS.map((point) => {
        const Icon = point.icon

        return (
          <li key={point.title} className="space-y-2">
            <span
              className={cn(
                "grid size-9 place-items-center rounded-xl",
                point.tone
              )}
            >
              <Icon className="size-4.5" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-balance">{point.title}</p>
            <p className="text-xs text-muted-foreground text-pretty">
              {point.body}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The left half of the desktop auth split. Absent below `lg`, where the centred
 * card is the whole screen. Its washes are token-built and clipped by the
 * aside's own `overflow-hidden` so they can never invent a scrollbar.
 */
export function AuthBrandPanel() {
  return (
    <aside className="relative isolate hidden overflow-hidden border-r border-border bg-muted/30 lg:flex lg:flex-col lg:justify-between lg:gap-10 lg:px-10 lg:py-12 xl:px-14 xl:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-primary/5"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 -z-10 size-96 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -right-20 -z-10 size-80 rounded-full bg-chart-5/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-1/4 -z-10 size-96 rounded-full bg-chart-2/10 blur-3xl"
      />

      <Link
        href="/"
        className="inline-flex w-fit items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Rocket className="size-5" aria-hidden="true" />
        </span>
        <span className="text-lg font-semibold tracking-tight">RaketShip</span>
      </Link>

      <div className="max-w-md space-y-8 xl:max-w-lg">
        <div className="space-y-3">
          {/* A paragraph, not a heading: the page's own h1 lives in the form
              column and must stay the first heading in the outline. */}
          <p className="text-3xl font-semibold tracking-tight text-balance xl:text-4xl">
            Build your raket
          </p>
          <p className="max-w-prose text-base text-muted-foreground text-pretty xl:text-lg">
            The tingi-style toolkit for Filipino MSMEs — start small, then grow
            the tools one module at a time.
          </p>
        </div>

        <ul className="space-y-5">
          {BRAND_POINTS.map((point) => {
            const Icon = point.icon

            return (
              <li key={point.title} className="flex gap-3.5">
                <span
                  className={cn(
                    "mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl",
                    point.tone
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-medium xl:text-base">
                    {point.title}
                  </p>
                  <p className="max-w-prose text-sm text-muted-foreground text-pretty">
                    {point.body}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="max-w-prose text-xs text-muted-foreground text-pretty">
        Mobile-first by design — kayang patakbuhin ang negosyo kahit cellphone
        lang ang dala mo.
      </p>
    </aside>
  )
}

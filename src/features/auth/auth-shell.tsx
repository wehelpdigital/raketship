import type { ReactNode } from "react"
import Link from "next/link"
import { Rocket } from "lucide-react"

import { cn } from "@/lib/utils"

interface AuthShellProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  className,
}: AuthShellProps) {
  return (
    <div className={cn("relative isolate w-full max-w-sm space-y-6", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-48 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/2 -z-10 h-40 w-64 -translate-x-1/2 rounded-full bg-chart-2/10 blur-3xl"
      />

      <header className="space-y-3 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Rocket className="size-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">RaketShip</span>
        </Link>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-muted-foreground text-pretty">{subtitle}</p>
          ) : null}
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        {children}
      </div>

      {footer ? <div className="space-y-6">{footer}</div> : null}
    </div>
  )
}

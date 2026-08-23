"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Rocket } from "lucide-react"

import { isNavItemActive, NAV_ITEMS } from "@/components/shell/bottom-nav"
import { ModuleIcon } from "@/components/module-icon"
import {
  accentChip,
  moduleHref,
  type ModuleNavItem,
} from "@/components/shell/module-nav"
import { cn } from "@/lib/utils"

export { accentChip, moduleHref, type ModuleNavItem }

/**
 * The desktop navigation. Below `lg` it is absent entirely — tablets use the
 * header's inline row and phones use the bottom tab bar, so exactly one
 * navigation surface is visible at any width.
 */
export function SideNav({
  modules = [],
  className,
}: {
  modules?: readonly ModuleNavItem[]
  className?: string
}) {
  const pathname = usePathname() ?? ""

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden w-64 shrink-0 flex-col border-r bg-card/40 lg:flex",
        className
      )}
    >
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Rocket className="size-4.5" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            RaketShip
          </span>
        </Link>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-2 no-scrollbar">
        <nav aria-label="Primary">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = isNavItemActive(pathname, item.href)
              const Icon = item.icon

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4.5 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* A group, not a destination — the heading labels the list rather than
            linking anywhere, so it is a plain <p>, not a nav item. */}
        <nav aria-labelledby="side-nav-modules">
          <p
            id="side-nav-modules"
            className="px-3 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground/80 uppercase"
          >
            Modules
          </p>

          {modules.length > 0 ? (
            <ul className="space-y-1">
              {modules.map((mod) => {
                const href = moduleHref(mod.id)
                const active = isNavItemActive(pathname, href)

                return (
                  <li key={mod.id}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-md",
                          active
                            ? "bg-primary/15 text-primary"
                            : accentChip(mod.accent)
                        )}
                      >
                        <ModuleIcon
                          name={mod.icon}
                          className="size-3.5"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{mod.name}</span>
                      {mod.tier ? (
                        <span className="shrink-0 text-[10px] font-medium text-muted-foreground/70">
                          {mod.tier}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-3 py-2 text-xs text-pretty text-muted-foreground">
              No modules yet.
            </p>
          )}

        </nav>
      </div>

      <div className="shrink-0 border-t px-5 py-4">
        <p className="text-xs text-pretty text-muted-foreground">
          Build your raket one module at a time.
        </p>
      </div>
    </aside>
  )
}

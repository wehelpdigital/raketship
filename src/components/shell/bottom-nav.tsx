"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CircleUser,
  LayoutDashboard,
  Rocket,
  Store,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** The star feature gets a filled chip so it reads as the main action. */
  emphasis?: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/raket", label: "Raket", icon: Rocket, emphasis: true },
  { href: "/marketplace", label: "Market", icon: Store },
  { href: "/account", label: "Account", icon: CircleUser },
]

/** Active on an exact match, or on any nested route below it. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (!pathname) return false
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  return path === href || path.startsWith(`${href}/`)
}

export function BottomNav({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-safe backdrop-blur md:hidden",
        className
      )}
    >
      <ul className="mx-auto flex w-full max-w-2xl items-stretch">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname ?? "", item.href)
          const Icon = item.icon

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] leading-none font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 mx-auto h-0.5 w-8 rounded-full bg-primary"
                  />
                ) : null}
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full transition-colors",
                    item.emphasis &&
                      (active
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/10 text-primary")
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

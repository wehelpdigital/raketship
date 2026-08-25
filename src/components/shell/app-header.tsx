"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Boxes, ChevronDown, LogOut, Rocket, UserRound } from "lucide-react"

import { isNavItemActive, NAV_ITEMS } from "@/components/shell/bottom-nav"
import {
  accentChip,
  badgeLabel,
  moduleHref,
  moduleSubItems,
  type ModuleNavItem,
  type NavBadges,
} from "@/components/shell/module-nav"
import { LocaleToggle } from "@/components/shell/locale-toggle"
import { ThemeToggle } from "@/components/shell/theme-toggle"
import { ModuleIcon } from "@/components/module-icon"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "@/features/auth/actions"
import { cn } from "@/lib/utils"

const PAGE_TITLES: ReadonlyArray<readonly [string, string]> = [
  ["/dashboard", "Home"],
  ["/raket", "Build your Raket"],
  ["/marketplace", "Raket Market"],
  ["/account", "Account"],
]

export function pageTitleFor(pathname: string): string {
  return PAGE_TITLES.find(([href]) => isNavItemActive(pathname, href))?.[1] ?? ""
}

export function initialsFrom(
  name?: string | null,
  email?: string | null
): string {
  const trimmed = (name ?? "").trim()
  if (trimmed) {
    return trimmed
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase()
  }
  const handle = (email ?? "").trim()
  return handle ? handle.charAt(0).toUpperCase() : "R"
}

export interface AppHeaderProps {
  name?: string | null
  email?: string | null
  modules?: readonly ModuleNavItem[]
  badges?: NavBadges
  className?: string
}

export function AppHeader({
  name,
  email,
  modules = [],
  badges = {},
  className,
}: AppHeaderProps) {
  const pathname = usePathname() ?? ""
  const title = pageTitleFor(pathname)
  const signOutForm = React.useRef<HTMLFormElement>(null)

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b bg-background/95 pt-safe backdrop-blur",
        className
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-2 px-4 sm:px-6 md:max-w-3xl lg:h-16 lg:max-w-5xl lg:px-8 xl:max-w-6xl">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Rocket className="size-4" aria-hidden="true" />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">
            RaketShip
          </span>
          <span className="sr-only sm:hidden">RaketShip</span>
        </Link>

        {/* The h1 stays in the tree at md — where it is the only one on the
            page — but yields its space to the inline nav below. */}
        {title ? (
          <>
            <span
              aria-hidden="true"
              className="h-5 w-px shrink-0 bg-border md:hidden"
            />
            <h1 className="min-w-0 truncate text-sm font-medium text-muted-foreground md:sr-only">
              {title}
            </h1>
          </>
        ) : null}

        {/* On wider screens this row is the navigation; the tab bar hides. */}
        <nav aria-label="Primary" className="hidden md:flex md:items-center md:gap-1 lg:hidden">
          {NAV_ITEMS.map((item) => {
            const active = isNavItemActive(pathname, item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <ModulesMenu modules={modules} badges={badges} pathname={pathname} />

          <LocaleToggle />

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger className="flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <Avatar>
                <AvatarFallback className="bg-primary/10 font-medium text-primary">
                  {initialsFrom(name, email)}
                </AvatarFallback>
              </Avatar>
              <span className="sr-only">Open account menu</span>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="w-56 min-w-56"
            >
              <div className="px-2 py-2">
                <p className="truncate text-sm font-medium">
                  {name?.trim() || "Your account"}
                </p>
                {email ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {email}
                  </p>
                ) : null}
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="h-11 px-2"
                render={<Link href="/account" />}
              >
                <UserRound aria-hidden="true" />
                My account
              </DropdownMenuItem>

              <DropdownMenuItem
                variant="destructive"
                className="h-11 px-2"
                onClick={() => signOutForm.current?.requestSubmit()}
              >
                <LogOut aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Kept outside the menu popup so it survives the menu closing. */}
          <form ref={signOutForm} action={signOut} className="hidden" />
        </div>
      </div>
    </header>
  )
}

/**
 * The Modules group for phones and tablets. The desktop sidebar renders the
 * same list inline, so this hides from `lg` up to keep one surface per width.
 */
function ModulesMenu({
  modules,
  badges,
  pathname,
}: {
  modules: readonly ModuleNavItem[]
  badges: NavBadges
  pathname: string
}) {
  const current = modules.find((m) =>
    isNavItemActive(pathname, moduleHref(m.id))
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden",
          current
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Boxes className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">
          {current ? current.name : "Modules"}
        </span>
        <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
        <span className="sr-only">Open modules menu</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="w-56 min-w-56">
        <p className="px-2 py-2 text-xs font-semibold tracking-wide text-muted-foreground/80 uppercase">
          Modules
        </p>

        {modules.length > 0 ? (
          modules.map((mod) => (
            <React.Fragment key={mod.id}>
              <DropdownMenuItem
                className="h-11 gap-2.5 px-2"
                render={<Link href={moduleHref(mod.id)} />}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md",
                    accentChip(mod.accent)
                  )}
                >
                  <ModuleIcon
                    name={mod.icon}
                    className="size-3.5"
                    aria-hidden="true"
                  />
                </span>
                <span className="min-w-0 flex-1 truncate">{mod.name}</span>
              </DropdownMenuItem>

              {moduleSubItems(mod.id).map((child) => (
                <DropdownMenuItem
                  key={child.id}
                  // Indented to sit under its parent rather than beside it.
                  className="h-10 gap-2.5 px-2 pl-10 text-muted-foreground"
                  render={<Link href={child.href} />}
                >
                  <ModuleIcon
                    name={child.icon}
                    className="size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{child.name}</span>
                  {badgeLabel(badges[child.id] ?? 0) ? (
                    <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground tabular-nums">
                      {badgeLabel(badges[child.id] ?? 0)}
                    </span>
                  ) : null}
                </DropdownMenuItem>
              ))}
            </React.Fragment>
          ))
        ) : (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            No modules yet.
          </p>
        )}

      </DropdownMenuContent>
    </DropdownMenu>
  )
}

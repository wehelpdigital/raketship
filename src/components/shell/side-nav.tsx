"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Rocket } from "lucide-react"

import { isNavItemActive, NAV_ITEMS } from "@/components/shell/bottom-nav"
import { ModuleIcon } from "@/components/module-icon"
import { NavPending } from "@/components/shell/nav-pending"
import {
  accentChip,
  badgeLabel,
  isModuleActive,
  moduleHref,
  moduleSubItems,
  type ModuleNavItem,
  type NavBadges,
} from "@/components/shell/module-nav"
import { Blocks } from "lucide-react"

import { useT } from "@/components/shell/locale-provider"
import { cn } from "@/lib/utils"

export { accentChip, moduleHref, type ModuleNavItem }

/**
 * The desktop navigation. Below `lg` it is absent entirely — tablets use the
 * header's inline row and phones use the bottom tab bar, so exactly one
 * navigation surface is visible at any width.
 */
export function SideNav({
  modules = [],
  badges = {},
  className,
}: {
  modules?: readonly ModuleNavItem[]
  badges?: NavBadges
  className?: string
}) {
  const pathname = usePathname()

  /*
    Which modules are folded open. Absent means open, so the pages are visible
    by default and a module has to be deliberately collapsed to disappear —
    hiding them until someone finds the chevron would hide the feature.

    Kept in component state rather than storage: the nav lives in the layout,
    so it survives every navigation, and there is no stored value to disagree
    with the server on the first paint.
  */
  const [openModules, setOpenModules] = React.useState<Record<string, boolean>>(
    {}
  ) ?? ""

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
              /*
                Build your Raket carries one child: the parts page. The parent
                must not light up with it — a highlight that covers two rows
                stops meaning "you are here".
              */
              const isRaket = item.href === "/raket"
              const partsActive =
                isRaket && isNavItemActive(pathname, "/raket/parts")
              const active =
                isNavItemActive(pathname, item.href) && !partsActive
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
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <NavPending />
                  </Link>

                  {isRaket ? (
                    <ul className="mt-1 space-y-1 pl-8">
                      <li>
                        <Link
                          href="/raket/parts"
                          aria-current={partsActive ? "page" : undefined}
                          className={cn(
                            "flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            partsActive
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <Blocks
                            className="size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate">
                            My raket parts
                          </span>
                          <NavPending />
                        </Link>
                      </li>
                    </ul>
                  ) : null}
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
                const matches = (target: string) =>
                  isNavItemActive(pathname, target)
                const active = isModuleActive(pathname, mod.id, matches)
                const children = moduleSubItems(mod.id)

                const expanded = openModules[mod.id] !== false
                const listId = `side-nav-${mod.id}-pages`

                return (
                  <li key={mod.id}>
                    {/* A row, not a link with a button inside it — an anchor
                        may not contain one, and the two do different things:
                        the label navigates, the chevron only folds. */}
                    <div className="flex items-center gap-1">
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
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
                      <NavPending />
                      {mod.tier ? (
                        <span className="shrink-0 text-[10px] font-medium text-muted-foreground/70">
                          {mod.tier}
                        </span>
                      ) : null}
                    </Link>

                    {children.length > 0 ? (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={listId}
                        aria-label={`${expanded ? "Itago" : "Ipakita"} ang mga pahina ng ${mod.name}`}
                        onClick={() =>
                          setOpenModules((previous) => ({
                            ...previous,
                            [mod.id]: !expanded,
                          }))
                        }
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <ChevronRight
                          className={cn(
                            "size-4 transition-transform motion-reduce:transition-none",
                            expanded && "rotate-90"
                          )}
                          aria-hidden="true"
                        />
                      </button>
                    ) : null}
                    </div>

                    {children.length > 0 && expanded ? (
                      // Indented to the parent's label rather than its icon, so
                      // the nesting reads without a connector line.
                      <ul id={listId} className="mt-1 space-y-1 pl-8">
                        {children.map((child) => {
                          const childActive = matches(child.href)
                          return (
                            <li key={child.id}>
                              <Link
                                href={child.href}
                                aria-current={childActive ? "page" : undefined}
                                className={cn(
                                  "flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                                  childActive
                                    ? "bg-primary/10 font-medium text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                              >
                                <ModuleIcon
                                  name={child.icon}
                                  className="size-3.5 shrink-0"
                                  aria-hidden="true"
                                />
                                <span className="min-w-0 flex-1 truncate">
                                  {child.name}
                                </span>
                                <NavBadge count={badges[child.id] ?? 0} />
                                <NavPending />
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
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

/**
 * An unread-style count beside a nav item.
 *
 * Destructive red because it is asking to be dealt with, not reporting a
 * total — and it disappears at zero rather than showing one, so an empty
 * badge never sits there looking like a bug.
 */
function NavBadge({ count }: { count: number }) {
  const t = useT()
  const label = badgeLabel(count)
  if (!label) return null

  return (
    <span
      className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground tabular-nums"
      aria-label={t("shell.badge.upcoming", { n: count })}
    >
      {label}
    </span>
  )
}

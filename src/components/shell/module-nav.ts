/**
 * Shared vocabulary for the Modules navigation group.
 *
 * Deliberately NOT a "use client" module: the app layout and the module pages
 * are Server Components and call these directly, which is impossible across a
 * client boundary — a client module's exports can only be rendered, not invoked.
 */

/** One activated module, flattened for navigation. */
export interface ModuleNavItem {
  id: string
  name: string
  icon: string
  accent: string
  tier: string | null
}

/**
 * Written out in full because Tailwind only ships classes it can see in the
 * source — `bg-chart-${n}/12` would compile to nothing.
 */
const ACCENT_CHIP: Record<string, string> = {
  "chart-1": "bg-chart-1/12 text-chart-1",
  "chart-2": "bg-chart-2/12 text-chart-2",
  "chart-3": "bg-chart-3/12 text-chart-3",
  "chart-4": "bg-chart-4/12 text-chart-4",
  "chart-5": "bg-chart-5/12 text-chart-5",
}

export function accentChip(accent: string | null | undefined): string {
  return (accent && ACCENT_CHIP[accent]) || ACCENT_CHIP["chart-1"]
}

/**
 * Modules with a bespoke home. These are static segments that deliberately
 * shadow the dynamic /modules/[moduleId] route; everything else falls through
 * to the generic page. Listed here so navigation and the generic page agree
 * about which is which.
 */
export const BESPOKE_MODULES = new Set(["business", "booking"])

/** A page inside a module, listed under it in the Modules group. */
export interface ModuleSubItem {
  id: string
  name: string
  href: string
  icon: string
}

/**
 * The pages a module offers beneath itself.
 *
 * Written out per module rather than derived, because these are bespoke
 * screens with bespoke routes — the generic /modules/[moduleId] page has
 * nothing to list. A module absent from here simply has no children.
 */
const SUB_ITEMS: Record<string, ModuleSubItem[]> = {
  booking: [
    {
      id: "booked",
      name: "Booked",
      href: "/modules/booking/booked",
      icon: "CalendarCheck",
    },
  ],
}

/** Counts to show beside sub-items, keyed by their id. */
export type NavBadges = Readonly<Record<string, number>>

/**
 * A count small enough to read at a glance.
 *
 * Past ninety-nine the exact number stops being information and starts being
 * a wide badge, so it caps.
 */
export function badgeLabel(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null
  return count > 99 ? "99+" : String(Math.trunc(count))
}

export function moduleSubItems(moduleId: string): ModuleSubItem[] {
  return SUB_ITEMS[moduleId] ?? []
}

/**
 * Whether the module itself is the current page, as opposed to one of its
 * children. Without excluding the children, opening Booked would light up
 * Booking as well and the highlight would stop meaning "you are here".
 */
export function isModuleActive(
  pathname: string,
  moduleId: string,
  matches: (href: string) => boolean
): boolean {
  if (!matches(moduleHref(moduleId))) return false
  return !moduleSubItems(moduleId).some((child) => matches(child.href))
}

export function moduleHref(moduleId: string): string {
  return `/modules/${moduleId}`
}

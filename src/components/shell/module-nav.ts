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

export function moduleHref(moduleId: string): string {
  return `/modules/${moduleId}`
}

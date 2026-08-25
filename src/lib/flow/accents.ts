/**
 * One colour per element on the raket board.
 *
 * Two constraints, both learned by looking: chart-1 is aliased to the shop's
 * primary, so a module shipping it twins the start card — and a FIXED chart
 * hue can twin the primary anyway, because the primary moves with the chosen
 * palette (a lila shop's primary sits at hue 305, five degrees from
 * chart-4's 300). So accents are assigned per account: keep the catalog's
 * accent when it is far enough from the shop's own colour and not yet worn
 * by another element; otherwise take the first substitute that is.
 */

/** Where the fixed chart tokens sit, in OKLCH hue degrees (globals.css). */
export const CHART_HUES: Record<string, number> = {
  "chart-2": 92,
  "chart-3": 152,
  "chart-4": 300,
  "chart-5": 235,
}

/**
 * Closer than this to the primary reads as the same colour at a glance.
 * Chosen so lila (305) rejects chart-4 (300) and accepts chart-5 (235).
 */
export const MIN_HUE_DELTA = 45

/** Circular distance between two hues, 0..180. */
export function hueDistance(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360
  return raw > 180 ? 360 - raw : raw
}

/**
 * The order substitutes are tried in. Blue first: it is the farthest thing
 * from the warm hues most shops pick.
 */
const SUBSTITUTES = ["chart-5", "chart-2", "chart-4", "chart-3"] as const

function wearable(
  accent: string,
  primaryHue: number,
  used: Set<string>
): boolean {
  const hue = CHART_HUES[accent]
  if (hue === undefined) return false
  if (used.has(accent)) return false
  return hueDistance(hue, primaryHue) >= MIN_HUE_DELTA
}

/**
 * Assigns each module the accent it will wear on the board.
 *
 * Deterministic — same modules, same palette, same answer — and total: when
 * every colour is either worn or too close to the primary, the least-bad
 * unused one is taken rather than none, because a card must be painted with
 * something.
 */
export function assignModuleAccents(
  modules: readonly { id: string; accent: string }[],
  primaryHue: number
): Record<string, string> {
  const used = new Set<string>()
  const out: Record<string, string> = {}

  for (const mod of modules) {
    let accent: string | undefined

    if (wearable(mod.accent, primaryHue, used)) {
      accent = mod.accent
    } else {
      accent = SUBSTITUTES.find((s) => wearable(s, primaryHue, used))
    }
    if (!accent) {
      // Everything is worn or near the primary: farthest unused hue wins.
      accent = [...SUBSTITUTES]
        .filter((s) => !used.has(s))
        .sort(
          (a, b) =>
            hueDistance(CHART_HUES[b], primaryHue) -
            hueDistance(CHART_HUES[a], primaryHue)
        )[0]
    }
    if (!accent) accent = mod.accent // more modules than colours; repeat late.

    used.add(accent)
    out[mod.id] = accent
  }

  return out
}

/** The hue off an oklch() string, or null when it does not parse. */
export function oklchHue(value: string | null | undefined): number | null {
  const match = /oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)/.exec(value ?? "")
  return match ? Number(match[1]) : null
}

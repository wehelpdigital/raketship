/**
 * The colour themes a raketero can pick from.
 *
 * GENERATED, then reviewed. Every pair here was measured, not chosen by eye:
 * each `primaryForeground` clears 4.5:1 on its `primary` in BOTH light and
 * dark, each `accentForeground` clears 7:1 on its `accent`, no value clips
 * out of sRGB, and every dark-mode primary is lifted in lightness because
 * full-chroma colour on near-black vibrates. The repo has an incident on
 * record — white on orange shipped at 3.56:1 — so none of this is eyeballed.
 * See scratchpad/make-palettes.mjs for the search and palettes.test.ts for the
 * assertions that keep it true.
 *
 * "pula" is the default and is pinned to the tokens already in globals.css, so
 * a user who never opens this module sees exactly the app they saw yesterday.
 *
 * Adding a palette: add it here and it appears in the picker, in the app and on
 * the public page. Nothing else needs touching — and no Tailwind class name is
 * ever built from these, only CSS custom properties, so the scanner is unaffected.
 */

export type PaletteFamily = "warm" | "cool" | "fresh" | "neutral"

/** The tokens one palette overrides, for one of the two modes. */
export interface PaletteTokens {
  primary: string
  primaryForeground: string
  ring: string
  accent: string
  accentForeground: string
}

export interface Palette {
  key: string
  name: string
  family: PaletteFamily
  light: PaletteTokens
  dark: PaletteTokens
}

/** Group headings for the picker. */
export const FAMILY_LABELS: Record<PaletteFamily, string> = {
  warm: "Mainit",
  cool: "Malamig",
  fresh: "Sariwa",
  neutral: "Simple",
}

export const PALETTES: readonly Palette[] = [
  {
    key: "pula",
    name: "Pula",
    family: "warm",
    light: {
      primary: "oklch(0.56 0.208 27)",
      primaryForeground: "oklch(0.99 0.004 25)",
      ring: "oklch(0.56 0.208 27)",
      accent: "oklch(0.955 0.022 25)",
      accentForeground: "oklch(0.26 0.04 25)",
    },
    dark: {
      primary: "oklch(0.66 0.19 27)",
      primaryForeground: "oklch(0.17 0.02 25)",
      ring: "oklch(0.66 0.19 27)",
      accent: "oklch(0.305 0.028 25)",
      accentForeground: "oklch(0.972 0.003 25)",
    },
  },
  {
    key: "rosas",
    name: "Rosas",
    family: "warm",
    light: {
      primary: "oklch(0.58 0.227 350)",
      primaryForeground: "oklch(0.99 0.004 350)",
      ring: "oklch(0.58 0.227 350)",
      accent: "oklch(0.955 0.022 350)",
      accentForeground: "oklch(0.26 0.05 350)",
    },
    dark: {
      primary: "oklch(0.68 0.221 350)",
      primaryForeground: "oklch(0.2 0.02 350)",
      ring: "oklch(0.68 0.221 350)",
      accent: "oklch(0.305 0.028 350)",
      accentForeground: "oklch(0.95 0.018 350)",
    },
  },
  {
    key: "dalandan",
    name: "Dalandan",
    family: "warm",
    light: {
      primary: "oklch(0.64 0.155 52)",
      primaryForeground: "oklch(0.2 0.02 52)",
      ring: "oklch(0.64 0.155 52)",
      accent: "oklch(0.955 0.022 52)",
      accentForeground: "oklch(0.26 0.04 52)",
    },
    dark: {
      primary: "oklch(0.74 0.156 52)",
      primaryForeground: "oklch(0.2 0.02 52)",
      ring: "oklch(0.74 0.156 52)",
      accent: "oklch(0.305 0.028 52)",
      accentForeground: "oklch(0.95 0.017 52)",
    },
  },
  {
    key: "mangga",
    name: "Mangga",
    family: "warm",
    light: {
      primary: "oklch(0.78 0.15 85)",
      primaryForeground: "oklch(0.2 0.02 85)",
      ring: "oklch(0.78 0.15 85)",
      accent: "oklch(0.955 0.022 85)",
      accentForeground: "oklch(0.26 0.032 85)",
    },
    dark: {
      primary: "oklch(0.88 0.115 85)",
      primaryForeground: "oklch(0.2 0.02 85)",
      ring: "oklch(0.88 0.115 85)",
      accent: "oklch(0.305 0.028 85)",
      accentForeground: "oklch(0.95 0.032 85)",
    },
  },
  {
    key: "kape",
    name: "Kape",
    family: "warm",
    light: {
      primary: "oklch(0.44 0.118 45)",
      primaryForeground: "oklch(0.99 0.004 45)",
      ring: "oklch(0.44 0.118 45)",
      accent: "oklch(0.955 0.022 45)",
      accentForeground: "oklch(0.26 0.045 45)",
    },
    dark: {
      primary: "oklch(0.54 0.136 45)",
      primaryForeground: "oklch(0.99 0.004 45)",
      ring: "oklch(0.54 0.136 45)",
      accent: "oklch(0.305 0.028 45)",
      accentForeground: "oklch(0.95 0.016 45)",
    },
  },
  {
    key: "langit",
    name: "Langit",
    family: "cool",
    light: {
      primary: "oklch(0.72 0.132 228)",
      primaryForeground: "oklch(0.2 0.02 228)",
      ring: "oklch(0.72 0.132 228)",
      accent: "oklch(0.955 0.022 228)",
      accentForeground: "oklch(0.26 0.03 228)",
    },
    dark: {
      primary: "oklch(0.82 0.102 228)",
      primaryForeground: "oklch(0.2 0.02 228)",
      ring: "oklch(0.82 0.102 228)",
      accent: "oklch(0.305 0.028 228)",
      accentForeground: "oklch(0.95 0.018 228)",
    },
  },
  {
    key: "dagat",
    name: "Dagat",
    family: "cool",
    light: {
      primary: "oklch(0.48 0.113 245)",
      primaryForeground: "oklch(0.99 0.004 245)",
      ring: "oklch(0.48 0.113 245)",
      accent: "oklch(0.955 0.02 245)",
      accentForeground: "oklch(0.26 0.039 245)",
    },
    dark: {
      primary: "oklch(0.595 0.132 245)",
      primaryForeground: "oklch(0.2 0.02 245)",
      ring: "oklch(0.595 0.132 245)",
      accent: "oklch(0.305 0.028 245)",
      accentForeground: "oklch(0.95 0.015 245)",
    },
  },
  {
    key: "turkesa",
    name: "Turkesa",
    family: "cool",
    light: {
      primary: "oklch(0.76 0.125 188)",
      primaryForeground: "oklch(0.2 0.02 188)",
      ring: "oklch(0.76 0.125 188)",
      accent: "oklch(0.955 0.022 188)",
      accentForeground: "oklch(0.26 0.027 188)",
    },
    dark: {
      primary: "oklch(0.86 0.132 188)",
      primaryForeground: "oklch(0.2 0.02 188)",
      ring: "oklch(0.86 0.132 188)",
      accent: "oklch(0.305 0.028 188)",
      accentForeground: "oklch(0.95 0.043 188)",
    },
  },
  {
    key: "indigo",
    name: "Indigo",
    family: "cool",
    light: {
      primary: "oklch(0.45 0.17 282)",
      primaryForeground: "oklch(0.99 0.004 282)",
      ring: "oklch(0.45 0.17 282)",
      accent: "oklch(0.955 0.019 282)",
      accentForeground: "oklch(0.26 0.05 282)",
    },
    dark: {
      primary: "oklch(0.55 0.17 282)",
      primaryForeground: "oklch(0.99 0.004 282)",
      ring: "oklch(0.55 0.17 282)",
      accent: "oklch(0.305 0.028 282)",
      accentForeground: "oklch(0.95 0.015 282)",
    },
  },
  {
    key: "lila",
    name: "Lila",
    family: "cool",
    light: {
      primary: "oklch(0.53 0.259 305)",
      primaryForeground: "oklch(0.99 0.004 305)",
      ring: "oklch(0.53 0.259 305)",
      accent: "oklch(0.955 0.022 305)",
      accentForeground: "oklch(0.26 0.05 305)",
    },
    dark: {
      primary: "oklch(0.63 0.221 305)",
      primaryForeground: "oklch(0.2 0.02 305)",
      ring: "oklch(0.63 0.221 305)",
      accent: "oklch(0.305 0.028 305)",
      accentForeground: "oklch(0.95 0.018 305)",
    },
  },
  {
    key: "dahon",
    name: "Dahon",
    family: "fresh",
    light: {
      primary: "oklch(0.52 0.135 150)",
      primaryForeground: "oklch(0.99 0.004 150)",
      ring: "oklch(0.52 0.135 150)",
      accent: "oklch(0.955 0.022 150)",
      accentForeground: "oklch(0.26 0.043 150)",
    },
    dark: {
      primary: "oklch(0.62 0.15 150)",
      primaryForeground: "oklch(0.2 0.02 150)",
      ring: "oklch(0.62 0.15 150)",
      accent: "oklch(0.305 0.028 150)",
      accentForeground: "oklch(0.95 0.05 150)",
    },
  },
  {
    key: "buko",
    name: "Buko",
    family: "fresh",
    light: {
      primary: "oklch(0.76 0.187 128)",
      primaryForeground: "oklch(0.2 0.02 128)",
      ring: "oklch(0.76 0.187 128)",
      accent: "oklch(0.955 0.022 128)",
      accentForeground: "oklch(0.26 0.04 128)",
    },
    dark: {
      primary: "oklch(0.86 0.198 128)",
      primaryForeground: "oklch(0.2 0.02 128)",
      ring: "oklch(0.86 0.198 128)",
      accent: "oklch(0.305 0.028 128)",
      accentForeground: "oklch(0.95 0.05 128)",
    },
  },
  {
    key: "ube",
    name: "Ube",
    family: "fresh",
    light: {
      primary: "oklch(0.52 0.225 328)",
      primaryForeground: "oklch(0.99 0.004 328)",
      ring: "oklch(0.52 0.225 328)",
      accent: "oklch(0.955 0.022 328)",
      accentForeground: "oklch(0.26 0.05 328)",
    },
    dark: {
      primary: "oklch(0.63 0.256 328)",
      primaryForeground: "oklch(0.2 0.02 328)",
      ring: "oklch(0.63 0.256 328)",
      accent: "oklch(0.305 0.028 328)",
      accentForeground: "oklch(0.95 0.025 328)",
    },
  },
  {
    key: "uling",
    name: "Uling",
    family: "neutral",
    light: {
      primary: "oklch(0.4 0.022 250)",
      primaryForeground: "oklch(0.99 0.004 250)",
      ring: "oklch(0.4 0.022 250)",
      accent: "oklch(0.955 0.02 250)",
      accentForeground: "oklch(0.26 0.044 250)",
    },
    dark: {
      primary: "oklch(0.5 0.022 250)",
      primaryForeground: "oklch(0.99 0.004 250)",
      ring: "oklch(0.5 0.022 250)",
      accent: "oklch(0.305 0.028 250)",
      accentForeground: "oklch(0.95 0.015 250)",
    },
  },
]

/** What a calendar gets when nobody has chosen: today's brand red. */
export const DEFAULT_PALETTE = "pula"

const BY_KEY = new Map(PALETTES.map((p) => [p.key, p]))

/** Never returns null: an unknown or missing key falls back to the brand. */
export function getPalette(key: string | null | undefined): Palette {
  return (key ? BY_KEY.get(key) : undefined) ?? BY_KEY.get(DEFAULT_PALETTE)!
}

export function isPaletteKey(key: string): boolean {
  return BY_KEY.has(key)
}

/**
 * The CSS that repaints the app in this palette.
 *
 * Two things make this safe to inject rather than fragile:
 *
 *  - `html:root` scores (0,1,1) against globals.css's `:root` at (0,1,0), and
 *    `html:root.dark` scores (0,2,1) against `.dark` at (0,1,0). Winning on
 *    specificity rather than on source order means it does not matter where in
 *    the document this lands, which matters because React hoists style tags.
 *  - The custom properties are set on the root element, so they inherit into
 *    dialogs and dropdowns too. Those portal to document.body, and a theme
 *    scoped to a wrapper div would leave every one of them in the default red.
 *
 * The values are drawn from this module, never from user input, so there is no
 * path from a stored string into the stylesheet.
 */
export function paletteCss(key: string | null | undefined): string {
  const p = getPalette(key)
  const block = (t: PaletteTokens) =>
    [
      `--primary:${t.primary}`,
      `--primary-foreground:${t.primaryForeground}`,
      `--ring:${t.ring}`,
      `--accent:${t.accent}`,
      `--accent-foreground:${t.accentForeground}`,
      // chart-1 is the brand hue in the seed data, so module chips and node
      // cards follow the business's colour rather than staying red beside it.
      `--chart-1:${t.primary}`,
    ].join(";")

  return `html:root{${block(p.light)}}html:root.dark{${block(p.dark)}}`
}

import { describe, expect, it } from "vitest"

import {
  DEFAULT_PALETTE,
  getPalette,
  isPaletteKey,
  PALETTES,
  paletteCss,
  type PaletteTokens,
} from "./palettes"

/*
  These re-derive the contrast maths rather than importing the generator's, so
  a bug in the generator cannot certify its own output. Calibrated below against
  a value globals.css documents independently.
*/

function parseOklch(input: string) {
  const inner = input.trim().replace(/^oklch\(/i, "").replace(/\)$/, "")
  const [l, c, h] = inner.split(/[\s,]+/).filter(Boolean).map(Number)
  return { L: l, C: c, H: h ?? 0 }
}

function toSrgb(input: string) {
  const { L, C, H } = parseOklch(input)
  const rad = (H * Math.PI) / 180
  const a = C * Math.cos(rad)
  const b = C * Math.sin(rad)

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  const overshoot = Math.max(0, ...linear.map((v) => Math.max(-v, v - 1)))
  const encoded = linear
    .map((v) => Math.min(1, Math.max(0, v)))
    .map((v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))

  return { srgb: encoded, clipped: overshoot > 1e-6 }
}

function luminance(value: string) {
  const [r, g, b] = toSrgb(value).srgb.map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string) {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

describe("the contrast maths this file judges with", () => {
  it("reproduces a ratio globals.css documents independently", () => {
    // The brand, recorded there at 5.2:1. If this drifts, every assertion
    // below is measuring the wrong thing and should not be believed.
    const measured = contrast("oklch(0.56 0.208 27)", "oklch(0.99 0.004 25)")
    expect(measured).toBeGreaterThan(4.9)
    expect(measured).toBeLessThan(5.4)
  })
})

describe("every palette", () => {
  const modes: ("light" | "dark")[] = ["light", "dark"]

  it.each(PALETTES.map((p) => [p.key, p] as const))(
    "%s carries its own text at AA in both modes",
    (_key, palette) => {
      for (const mode of modes) {
        const t: PaletteTokens = palette[mode]
        expect(contrast(t.primary, t.primaryForeground)).toBeGreaterThanOrEqual(4.5)
      }
    }
  )

  it.each(PALETTES.map((p) => [p.key, p] as const))(
    "%s keeps small text readable on its accent",
    (_key, palette) => {
      for (const mode of modes) {
        const t: PaletteTokens = palette[mode]
        // The accent is a hover and selected ground; it carries small text, so
        // it is held past AA rather than at it.
        expect(contrast(t.accent, t.accentForeground)).toBeGreaterThanOrEqual(7)
      }
    }
  )

  it.each(PALETTES.map((p) => [p.key, p] as const))(
    "%s lifts its primary for dark mode",
    (_key, palette) => {
      // Full-chroma colour on near-black vibrates, which is why globals.css
      // already lifts the brand from 0.56 to 0.66.
      expect(parseOklch(palette.dark.primary).L).toBeGreaterThan(
        parseOklch(palette.light.primary).L
      )
    }
  )

  it.each(PALETTES.map((p) => [p.key, p] as const))(
    "%s stays inside sRGB",
    (_key, palette) => {
      // A colour that clips is not the colour that was measured, so a clipped
      // value would quietly invalidate the ratios above.
      for (const mode of modes) {
        for (const value of Object.values(palette[mode])) {
          expect(toSrgb(value).clipped, value).toBe(false)
        }
      }
    }
  )

  it("has a stable, unique key for each", () => {
    const keys = PALETTES.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("writes ring to match primary, so focus follows the brand", () => {
    for (const palette of PALETTES) {
      expect(palette.light.ring).toBe(palette.light.primary)
      expect(palette.dark.ring).toBe(palette.dark.primary)
    }
  })
})

describe("the default", () => {
  it("is the brand red already in globals.css, token for token", () => {
    // A user who never opens this module must see exactly the app they saw
    // before it existed. Any drift here silently restyles everyone.
    const pula = getPalette(DEFAULT_PALETTE)
    expect(pula.light.primary).toBe("oklch(0.56 0.208 27)")
    expect(pula.light.primaryForeground).toBe("oklch(0.99 0.004 25)")
    expect(pula.light.accent).toBe("oklch(0.955 0.022 25)")
    expect(pula.light.accentForeground).toBe("oklch(0.26 0.04 25)")
    expect(pula.dark.primary).toBe("oklch(0.66 0.19 27)")
    expect(pula.dark.accent).toBe("oklch(0.305 0.028 25)")
  })
})

describe("getPalette", () => {
  it("falls back rather than returning nothing", () => {
    // A palette removed from the app must degrade to the brand, not crash a
    // page for everyone who had chosen it.
    expect(getPalette("no-such-palette").key).toBe(DEFAULT_PALETTE)
    expect(getPalette(null).key).toBe(DEFAULT_PALETTE)
    expect(getPalette(undefined).key).toBe(DEFAULT_PALETTE)
    expect(getPalette("").key).toBe(DEFAULT_PALETTE)
  })

  it("returns the one asked for when it exists", () => {
    expect(getPalette("dagat").key).toBe("dagat")
  })
})

describe("isPaletteKey", () => {
  it("is what the server action validates against", () => {
    expect(isPaletteKey("pula")).toBe(true)
    expect(isPaletteKey("dagat")).toBe(true)
    expect(isPaletteKey("__proto__")).toBe(false)
    expect(isPaletteKey("constructor")).toBe(false)
    expect(isPaletteKey("nope")).toBe(false)
  })
})

describe("paletteCss", () => {
  it("beats globals.css on specificity, not on source order", () => {
    const css = paletteCss("dagat")
    // :root is (0,1,0); html:root is (0,1,1). React hoists style tags, so
    // depending on order would be depending on something we do not control.
    expect(css).toContain("html:root{")
    expect(css).toContain("html:root.dark{")
  })

  it("sets the tokens the whole app is painted with", () => {
    const css = paletteCss("dagat")
    for (const token of [
      "--primary:",
      "--primary-foreground:",
      "--ring:",
      "--accent:",
      "--accent-foreground:",
      "--chart-1:",
    ]) {
      expect(css).toContain(token)
    }
  })

  it("emits the chosen palette's actual values", () => {
    const dagat = getPalette("dagat")
    expect(paletteCss("dagat")).toContain(`--primary:${dagat.light.primary}`)
    expect(paletteCss("dagat")).toContain(`--primary:${dagat.dark.primary}`)
  })

  it("cannot be steered by a stored string", () => {
    // The value goes through the table, never into the CSS. This is what makes
    // it safe to inject with dangerouslySetInnerHTML.
    const hostile = paletteCss("</style><script>alert(1)</script>")
    expect(hostile).not.toContain("<script")
    expect(hostile).not.toContain("</style")
    expect(hostile).toBe(paletteCss(DEFAULT_PALETTE))
  })

  it("falls back to the brand for an unknown key", () => {
    expect(paletteCss("nope")).toBe(paletteCss(DEFAULT_PALETTE))
  })
})

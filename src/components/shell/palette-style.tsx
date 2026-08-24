import { paletteCss } from "@/lib/theme/palettes"

export interface PaletteStyleProps {
  /** A palette key. Anything unrecognised falls back to the brand. */
  preset: string | null | undefined
}

/**
 * Repaints the app in the business's chosen colour.
 *
 * Server-rendered, so the colour is in the very first byte of HTML — a branding
 * feature that flashes the default red before correcting itself is worse than
 * no branding at all. There is no client component and no effect here on
 * purpose.
 *
 * `dangerouslySetInnerHTML` is the only way to put text inside a <style>, and
 * it is safe here for a reason worth stating: the CSS is built by paletteCss()
 * from a fixed table of literals in src/lib/theme/palettes.ts. An unknown key
 * resolves to the default rather than being interpolated, so a value out of the
 * database cannot reach the stylesheet.
 */
export function PaletteStyle({ preset }: PaletteStyleProps) {
  return (
    <style
      // React 19 hoists a style with href+precedence into <head> and dedupes on
      // href, so the same palette rendered by nested layouts emits once.
      href={`palette-${preset ?? "default"}`}
      precedence="high"
      dangerouslySetInnerHTML={{ __html: paletteCss(preset) }}
    />
  )
}

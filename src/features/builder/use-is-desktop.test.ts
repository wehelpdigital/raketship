import { describe, expect, it } from "vitest"

import {
  DESKTOP_QUERY,
  sheetSideClass,
  type SheetSide,
} from "@/features/builder/use-is-desktop"

const SIDES: readonly SheetSide[] = ["bottom", "right"]

describe("sheetSideClass", () => {
  it("dresses the phone sheet as a bottom sheet", () => {
    const classes = sheetSideClass("bottom")

    expect(classes).toContain("rounded-t-xl")
    expect(classes).toContain("max-h-[85dvh]")
  })

  it("dresses the desktop sheet as a side rail that beats the base width", () => {
    // The `!` matters: `data-[side=right]:sm:max-w-sm` in the Sheet primitive
    // is an attribute selector, so a plain utility would lose to it.
    expect(sheetSideClass("right")).toContain("max-w-md!")
  })

  it("hands back whole class names, never an interpolated one", () => {
    for (const side of SIDES) {
      const classes = sheetSideClass(side)
      expect(classes).not.toContain("${")
      expect(classes).not.toContain("undefined")
      expect(classes.trim().length).toBeGreaterThan(0)
    }
  })
})

describe("DESKTOP_QUERY", () => {
  it("is pinned to the same 64rem that the lg: utilities use", () => {
    // In `px` this would drift for anyone whose browser default font size is
    // not 16px, and the sheet would flip on a different width than the shell.
    expect(DESKTOP_QUERY).toBe("(min-width: 64rem)")
  })
})

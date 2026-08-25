import { describe, expect, it } from "vitest"

import {
  assignModuleAccents,
  hueDistance,
  MIN_HUE_DELTA,
  oklchHue,
} from "./accents"

describe("hueDistance", () => {
  it("measures around the circle, not across it", () => {
    expect(hueDistance(10, 350)).toBe(20)
    expect(hueDistance(0, 180)).toBe(180)
    expect(hueDistance(92, 92)).toBe(0)
  })
})

describe("oklchHue", () => {
  it("reads the hue off a token value", () => {
    expect(oklchHue("oklch(0.53 0.259 305)")).toBe(305)
    expect(oklchHue("oklch(0.56 0.208 27)")).toBe(27)
  })

  it("refuses to guess at anything else", () => {
    expect(oklchHue("#ff0000")).toBeNull()
    expect(oklchHue(null)).toBeNull()
    expect(oklchHue("")).toBeNull()
  })
})

describe("assignModuleAccents", () => {
  it("keeps a catalog accent that is far from the shop's colour", () => {
    // Pula sits at 27; chart-4 (300) is circularly 87 away — wearable.
    const out = assignModuleAccents(
      [{ id: "client-manager", accent: "chart-4" }],
      27
    )
    expect(out["client-manager"]).toBe("chart-4")
  })

  it("moves an accent that would twin the shop's own colour", () => {
    // Lila sits at 305, five degrees from chart-4's 300 — the exact clash
    // that was on screen: the start card and Client Manager both violet.
    const out = assignModuleAccents(
      [{ id: "client-manager", accent: "chart-4" }],
      305
    )
    expect(out["client-manager"]).not.toBe("chart-4")
  })

  it("never lets two elements wear the same colour", () => {
    const out = assignModuleAccents(
      [
        { id: "booking", accent: "chart-1" },
        { id: "client-manager", accent: "chart-4" },
        { id: "invoicing", accent: "chart-5" },
      ],
      305
    )
    const worn = Object.values(out)
    expect(new Set(worn).size).toBe(worn.length)
    for (const accent of worn) {
      expect(accent).not.toBe("chart-1")
    }
  })

  it("is deterministic", () => {
    const modules = [
      { id: "booking", accent: "chart-1" },
      { id: "client-manager", accent: "chart-4" },
    ]
    expect(assignModuleAccents(modules, 305)).toEqual(
      assignModuleAccents(modules, 305)
    )
  })

  it("always paints, even when every colour is near the primary or worn", () => {
    // Four modules, and a primary that disqualifies half the wheel: the
    // least-bad unused colour still lands on each card.
    const out = assignModuleAccents(
      [
        { id: "a", accent: "chart-1" },
        { id: "b", accent: "chart-1" },
        { id: "c", accent: "chart-1" },
        { id: "d", accent: "chart-1" },
      ],
      235
    )
    const worn = Object.values(out)
    expect(worn).toHaveLength(4)
    expect(new Set(worn).size).toBe(4)
  })

  it("honours the published threshold", () => {
    // Just inside the threshold moves; just outside stays.
    const nearlyClashing = 300 - (MIN_HUE_DELTA - 1)
    const safelyApart = 300 - (MIN_HUE_DELTA + 1)
    expect(
      assignModuleAccents([{ id: "m", accent: "chart-4" }], nearlyClashing)["m"]
    ).not.toBe("chart-4")
    expect(
      assignModuleAccents([{ id: "m", accent: "chart-4" }], safelyApart)["m"]
    ).toBe("chart-4")
  })
})

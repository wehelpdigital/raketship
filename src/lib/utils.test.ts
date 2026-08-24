import { describe, expect, it } from "vitest"

import { formatPeso, parsePeso } from "./utils"

describe("formatPeso", () => {
  it("drops the centavos when there are none to show", () => {
    expect(formatPeso(29900)).toBe("₱299")
  })

  it("keeps them when the amount is not whole pesos", () => {
    expect(formatPeso(35050)).toBe("₱350.50")
  })
})

describe("parsePeso", () => {
  it("reads what someone actually types", () => {
    expect(parsePeso("350")).toBe(35000)
    expect(parsePeso("350.50")).toBe(35050)
    expect(parsePeso("₱1,250")).toBe(125000)
    expect(parsePeso(" 99 ")).toBe(9900)
  })

  it("round-trips through formatPeso", () => {
    expect(parsePeso(formatPeso(35050))).toBe(35050)
  })

  it("refuses a third decimal rather than rounding it away", () => {
    // Silently rounding changes what a customer is charged.
    expect(parsePeso("350.505")).toBeNull()
  })

  it("returns null for anything that is not a price", () => {
    expect(parsePeso("")).toBeNull()
    expect(parsePeso("   ")).toBeNull()
    expect(parsePeso(".")).toBeNull()
    expect(parsePeso("libre")).toBeNull()
    expect(parsePeso("-50")).toBeNull()
    expect(parsePeso("1e3")).toBeNull()
  })

  it("does not eat digits when stripping the currency noise", () => {
    // A stray character class here once swallowed every letter s; the digits
    // are what matter, so they are asserted exactly.
    expect(parsePeso("₱ 1,050.25")).toBe(105025)
  })
})

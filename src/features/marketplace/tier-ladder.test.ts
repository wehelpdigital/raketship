import { describe, expect, it, vi } from "vitest"

import { deltaFeatures, tierState } from "@/features/marketplace/tier-ladder"

// The component pulls in the server action module; the ladder's pure logic is
// what this file is about.
vi.mock("@/features/marketplace/actions", () => ({ setModuleTier: vi.fn() }))

const STARTER = [
  "Booking form",
  "Wait / delay timer",
  "Email confirmation",
  "20 bookings per month",
]

const PLUS = [
  "Everything in Starter",
  "SMS reminders",
  "Yes/no branching",
  "Calendar sync",
  "Unlimited bookings",
]

describe("deltaFeatures", () => {
  it("returns everything for the first rung", () => {
    expect(deltaFeatures(STARTER)).toEqual(STARTER)
  })

  it("drops the rollup line and anything already carried up", () => {
    expect(deltaFeatures(PLUS, STARTER)).toEqual([
      "SMS reminders",
      "Yes/no branching",
      "Calendar sync",
      "Unlimited bookings",
    ])
  })

  it("ignores case and padding when comparing", () => {
    expect(deltaFeatures(["  SMS reminders "], ["sms reminders"])).toEqual([])
  })

  it("de-duplicates within a single tier", () => {
    expect(deltaFeatures(["Webhooks", "Webhooks"])).toEqual(["Webhooks"])
  })
})

describe("tierState", () => {
  const owned = { owned: true, ownedTierId: "plus", ownedLevel: 2 }

  it("locks every rung until the module is activated", () => {
    expect(
      tierState("starter", 1, {
        owned: false,
        ownedTierId: null,
        ownedLevel: null,
      })
    ).toBe("locked")
  })

  it("marks the owned tier as current", () => {
    expect(tierState("plus", 2, owned)).toBe("current")
  })

  it("marks lower tiers as included", () => {
    expect(tierState("starter", 1, owned)).toBe("included")
  })

  it("offers higher tiers as upgrades", () => {
    expect(tierState("pro", 3, owned)).toBe("upgrade")
  })

  it("treats a missing tier row as room to upgrade", () => {
    expect(
      tierState("starter", 1, {
        owned: true,
        ownedTierId: null,
        ownedLevel: null,
      })
    ).toBe("upgrade")
  })
})

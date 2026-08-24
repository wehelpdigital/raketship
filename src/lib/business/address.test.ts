import { describe, expect, it } from "vitest"

import { addressLine, landmarkLine } from "./address"
import type { BusinessProfileRow } from "@/lib/supabase/types"

function business(
  overrides: Partial<BusinessProfileRow> = {}
): BusinessProfileRow {
  return {
    user_id: "user-1",
    business_name: null,
    tagline: null,
    description: null,
    logo_path: null,
    logo_zoom: 1,
    logo_x: 50,
    logo_y: 50,
    cover_path: null,
    cover_zoom: 1,
    cover_x: 50,
    cover_y: 50,
    theme_preset: "pula",
    mobile_number: null,
    chat_apps: [],
    facebook_url: null,
    instagram_handle: null,
    website_url: null,
    street_address: null,
    barangay: null,
    city: null,
    province: null,
    landmark: null,
    address_visibility: "area",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

const FULL = {
  street_address: "Blk 4 Lot 12 Sampaguita St.",
  barangay: "Concepcion Uno",
  city: "Marikina City",
  province: "Metro Manila",
  landmark: "Katapat ng Mercury Drug",
}

describe("addressLine", () => {
  it("shows everything when the owner asked for that", () => {
    expect(addressLine(business({ ...FULL, address_visibility: "full" }))).toBe(
      "Blk 4 Lot 12 Sampaguita St., Concepcion Uno, Marikina City, Metro Manila"
    )
  })

  it("drops the street on the default setting", () => {
    // The one that protects a raket run out of a bedroom, and it is the
    // DEFAULT — so filling the address in can never leak a home by accident.
    const line = addressLine(business({ ...FULL, address_visibility: "area" }))
    expect(line).toBe("Concepcion Uno, Marikina City, Metro Manila")
    expect(line).not.toContain("Sampaguita")
  })

  it("shows nothing at all when hidden", () => {
    expect(
      addressLine(business({ ...FULL, address_visibility: "hidden" }))
    ).toBeNull()
  })

  it("returns null rather than a line of commas when nothing is filled in", () => {
    expect(addressLine(business())).toBeNull()
  })
})

describe("landmarkLine", () => {
  it("is published alongside a visible address", () => {
    expect(landmarkLine(business({ ...FULL, address_visibility: "area" }))).toBe(
      "Katapat ng Mercury Drug"
    )
  })

  it("is withheld under the same gate as the address", () => {
    // A landmark locates a house as precisely as a street number does, so it
    // must not survive a setting that hid the street.
    expect(
      landmarkLine(business({ ...FULL, address_visibility: "hidden" }))
    ).toBeNull()
  })

  it("agrees with addressLine about what hidden means", () => {
    // The header prints one and the footer prints the other. If they ever
    // disagreed, the disagreement would be someone's home on a public page.
    for (const visibility of ["full", "area", "hidden"] as const) {
      const row = business({ ...FULL, address_visibility: visibility })
      const hidden = visibility === "hidden"
      expect(addressLine(row) === null).toBe(hidden)
      expect(landmarkLine(row) === null).toBe(hidden)
    }
  })

  it("treats blank as nothing", () => {
    expect(landmarkLine(business({ landmark: "   " }))).toBeNull()
  })
})

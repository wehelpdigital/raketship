import { describe, expect, it, vi } from "vitest"

import type { BusinessProfileRow } from "@/lib/supabase/types"

import { bookingGlance, businessGlance } from "./glance"

vi.mock("@/lib/env", () => ({
  env: { supabaseUrl: "https://example.supabase.co" },
}))

function profile(overrides: Partial<BusinessProfileRow> = {}): BusinessProfileRow {
  return {
    user_id: "u1",
    business_name: "Gupit ni Nena",
    description: null,
    logo_path: null,
    logo_zoom: 1,
    logo_x: 50,
    logo_y: 50,
    cover_path: null,
    cover_zoom: 1,
    cover_x: 50,
    cover_y: 50,
    theme_preset: "dagat",
    mobile_number: null,
    email: null,
    facebook_url: null,
    instagram_url: null,
    tiktok_url: null,
    address_line: null,
    barangay: null,
    city: null,
    province: null,
    landmark: null,
    address_visibility: "area",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as BusinessProfileRow
}

describe("bookingGlance", () => {
  it("says there is nothing rather than counting to zero", () => {
    const glance = bookingGlance(
      { calendars: 0, published: 0, upcoming: 0 },
      "fil"
    )
    expect(glance.lines).toEqual(["Wala pang calendar"])
    expect(glance.live).toBe(false)
  })

  it("counts the calendars and what is coming", () => {
    const glance = bookingGlance(
      { calendars: 2, published: 1, upcoming: 5 },
      "fil"
    )
    expect(glance.lines[0]).toBe("2 calendar · 1 live")
    expect(glance.lines[1]).toBe("5 paparating na booking")
    expect(glance.live).toBe(true)
  })

  it("is not live while everything is a draft", () => {
    const glance = bookingGlance(
      { calendars: 1, published: 0, upcoming: 0 },
      "fil"
    )
    expect(glance.lines[0]).toBe("1 calendar · draft pa")
    expect(glance.lines[1]).toBe("Walang paparating")
    expect(glance.live).toBe(false)
  })

  it("speaks English when asked", () => {
    const glance = bookingGlance(
      { calendars: 2, published: 2, upcoming: 1 },
      "en"
    )
    expect(glance.lines[0]).toBe("2 calendars · 2 live")
    expect(glance.lines[1]).toBe("1 upcoming booking")
  })
})

describe("businessGlance", () => {
  it("asks for the setup while there is nothing to show", () => {
    expect(businessGlance(null, "fil").lines).toEqual([
      "I-set up ang detalye ng negosyo",
    ])
    expect(
      businessGlance(profile({ business_name: "  " }), "fil").lines
    ).toEqual(["I-set up ang detalye ng negosyo"])
  })

  it("wears the shop's own name and theme", () => {
    const glance = businessGlance(profile(), "fil")
    expect(glance.lines[0]).toBe("Gupit ni Nena")
    expect(glance.lines[1]).toBe("Tema: Dagat")
    expect(glance.swatches).toHaveLength(2)
    expect(glance.swatches?.[0]).toMatch(/^oklch\(/)
  })

  it("frames the logo the way the owner framed it", () => {
    const glance = businessGlance(
      profile({ logo_path: "u1/logo.png", logo_zoom: 2, logo_x: 30, logo_y: 60 }),
      "fil"
    )
    expect(glance.logoUrl).toContain("/business-media/u1/logo.png")
    expect(glance.logoCrop).toEqual({ zoom: 2, x: 30, y: 60 })
  })

  it("falls back to the brand palette on an unknown key", () => {
    // A removed palette must not blank the card of everyone who chose it.
    const glance = businessGlance(profile({ theme_preset: "wala-na" }), "fil")
    expect(glance.lines[1]).toBe("Tema: Pula")
    expect(glance.swatches).toHaveLength(2)
  })

  it("leaves live to the Booking card", () => {
    expect(businessGlance(profile(), "fil").live).toBe(false)
  })
})

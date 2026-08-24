import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { BusinessHeader } from "./business-header"
import type { BusinessProfileRow } from "@/lib/supabase/types"

/*
  mediaUrl() needs NEXT_PUBLIC_SUPABASE_URL, which the test environment does
  not set — so left alone it returns null and no image ever renders here,
  whatever the component does. Stubbed to the shape it really produces, which
  is covered on its own in lib/business/media.test.ts.
*/
vi.mock("@/lib/business/media", async () => {
  const real = await vi.importActual<typeof import("@/lib/business/media")>(
    "@/lib/business/media"
  )
  return {
    ...real,
    mediaUrl: (path: string | null | undefined) =>
      path ? `https://example.test/storage/${path}` : null,
  }
})

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

function renderHeader(
  overrides: Partial<React.ComponentProps<typeof BusinessHeader>> = {}
) {
  return render(
    <BusinessHeader
      business={business()}
      fallbackName="Gupit"
      timeLabel="30 min"
      zoneLabel="Manila · GMT+8"
      {...overrides}
    />
  )
}

const ADDRESS = {
  street_address: "Blk 4 Lot 12 Sampaguita St.",
  barangay: "Concepcion Uno",
  city: "Marikina City",
  province: "Metro Manila",
}

describe("what the header shows", () => {
  it("names the business, with the length and the zone beside it", () => {
    renderHeader({ business: business({ business_name: "Salon ni Nena" }) })

    expect(
      screen.getByRole("heading", { name: "Salon ni Nena" })
    ).toBeInTheDocument()
    expect(screen.getByText("30 min")).toBeInTheDocument()
    expect(screen.getByText("Manila · GMT+8")).toBeInTheDocument()
  })

  it("falls back to the calendar's name when the business has none", () => {
    renderHeader({ fallbackName: "Gupit ni Nena" })
    expect(
      screen.getByRole("heading", { name: "Gupit ni Nena" })
    ).toBeInTheDocument()
  })

  it("shows initials until there is a logo", () => {
    renderHeader({ business: business({ business_name: "Salon ni Nena" }) })
    expect(screen.getByText("SN")).toBeInTheDocument()
  })

  it("still renders when there is no business row at all", () => {
    // A raket that has never opened the module still has a booking link.
    renderHeader({ business: null, fallbackName: "Gupit" })
    expect(screen.getByRole("heading", { name: "Gupit" })).toBeInTheDocument()
    expect(screen.getByText("30 min")).toBeInTheDocument()
  })
})

describe("the two names", () => {
  it("says what is being booked when it differs from the shop", () => {
    renderHeader({
      business: business({ business_name: "Salon ni Nena" }),
      bookingName: "Gupit at kulay",
    })
    expect(
      screen.getByRole("heading", { name: "Salon ni Nena" })
    ).toBeInTheDocument()
    expect(screen.getByText("Gupit at kulay")).toBeInTheDocument()
  })

  it("does not say the same thing twice", () => {
    renderHeader({
      business: business({ business_name: "Salon ni Nena" }),
      bookingName: "Salon ni Nena",
    })
    expect(screen.getAllByText("Salon ni Nena")).toHaveLength(1)
  })

  it("treats a blank booking name as none", () => {
    renderHeader({
      business: business({ business_name: "Salon ni Nena" }),
      bookingName: "   ",
    })
    expect(screen.getAllByText(/Salon ni Nena/)).toHaveLength(1)
  })
})

describe("the location line", () => {
  it("sits in the header, under the same gate as everywhere else", () => {
    renderHeader({
      business: business({ ...ADDRESS, address_visibility: "area" }),
    })
    expect(screen.getByText(/Concepcion Uno/)).toBeInTheDocument()
    // "area" withholds the street.
    expect(screen.queryByText(/Sampaguita/)).not.toBeInTheDocument()
  })

  it("shows the street when the owner chose to", () => {
    renderHeader({
      business: business({ ...ADDRESS, address_visibility: "full" }),
    })
    expect(screen.getByText(/Sampaguita/)).toBeInTheDocument()
  })

  it("shows nothing when the owner hid it", () => {
    renderHeader({
      business: business({ ...ADDRESS, address_visibility: "hidden" }),
    })
    expect(screen.queryByText(/Concepcion Uno/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Marikina/)).not.toBeInTheDocument()
  })

  it("leaves the row out entirely when there is no address", () => {
    const { container } = renderHeader()
    expect(container.querySelector(".lucide-map-pin")).toBeNull()
  })
})

describe("the cover photo", () => {
  it("is not in the header any more", () => {
    // It was a 3:1 band above everything, which on a phone pushed the name,
    // the length and the address below the fold to show a picture that
    // answers none of those questions.
    const { container } = renderHeader({
      business: business({
        cover_path: "user-1/cover.png",
        business_name: "Salon ni Nena",
      }),
    })

    const images = [...container.querySelectorAll("img")]
    expect(images.some((img) => img.src.includes("cover"))).toBe(false)
  })

  it("does not stop the logo being shown", () => {
    const { container } = renderHeader({
      business: business({
        cover_path: "user-1/cover.png",
        logo_path: "user-1/logo.png",
      }),
    })
    const images = [...container.querySelectorAll("img")]
    expect(images.some((img) => img.src.includes("logo"))).toBe(true)
  })
})

describe("how the photo lines up with the name", () => {
  it("centres the two against each other rather than top-aligning them", () => {
    // jsdom does no layout, so this pins the rule rather than the pixels. The
    // geometry it encodes: the photo is 64px (80 at sm) and a column of just a
    // name and one meta row is about 50, so items-start left the photo hanging
    // below the text it sits beside. items-center lines up whichever is
    // shorter against the taller one, which holds whether the business filled
    // in a tagline and an address or left both empty.
    const { container } = renderHeader({
      business: business({ business_name: "Salon ni Nena" }),
    })

    const row = container.querySelector("header > div")
    expect(row).toHaveClass("items-center")
    expect(row).not.toHaveClass("items-start")
  })

  it("keeps the photo first, so it stays the left column", () => {
    const { container } = renderHeader({
      business: business({ business_name: "Salon ni Nena" }),
    })
    const row = container.querySelector("header > div")
    // The initials stand in for the photo when there is no logo.
    expect(row?.firstElementChild).toHaveTextContent("SN")
  })
})

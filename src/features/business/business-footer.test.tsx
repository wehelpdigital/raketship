import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { addressLine, BusinessFooter } from "./business-footer"
import { BusinessHeader } from "./business-header"
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

const FULL_ADDRESS = {
  street_address: "Blk 4 Lot 12 Sampaguita St.",
  barangay: "Concepcion Uno",
  city: "Marikina City",
  province: "Metro Manila",
}

describe("addressLine", () => {
  it("shows everything when the owner asked for that", () => {
    const line = addressLine(
      business({ ...FULL_ADDRESS, address_visibility: "full" })
    )
    expect(line).toBe(
      "Blk 4 Lot 12 Sampaguita St., Concepcion Uno, Marikina City, Metro Manila"
    )
  })

  it("drops the street on the default setting", () => {
    // This is the one that protects a raket run out of a bedroom, and it is
    // the DEFAULT, so filling the address in can never leak a home by accident.
    const line = addressLine(
      business({ ...FULL_ADDRESS, address_visibility: "area" })
    )
    expect(line).toBe("Concepcion Uno, Marikina City, Metro Manila")
    expect(line).not.toContain("Sampaguita")
    expect(line).not.toContain("Blk 4")
  })

  it("shows nothing at all when hidden", () => {
    expect(
      addressLine(business({ ...FULL_ADDRESS, address_visibility: "hidden" }))
    ).toBeNull()
  })

  it("returns null rather than a line of commas when nothing is filled in", () => {
    expect(addressLine(business())).toBeNull()
  })
})

describe("BusinessFooter", () => {
  it("renders nothing when the business is empty", () => {
    const { container } = render(<BusinessFooter business={business()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when there is no business at all", () => {
    const { container } = render(<BusinessFooter business={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("never prints the street when the setting says area", () => {
    render(
      <BusinessFooter
        business={business({ ...FULL_ADDRESS, address_visibility: "area" })}
      />
    )
    expect(screen.getByText(/Concepcion Uno/)).toBeInTheDocument()
    expect(screen.queryByText(/Sampaguita/)).not.toBeInTheDocument()
  })

  it("never prints any of it when the setting says hidden", () => {
    render(
      <BusinessFooter
        business={business({ ...FULL_ADDRESS, address_visibility: "hidden" })}
      />
    )
    expect(screen.queryByText(/Sampaguita/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Concepcion Uno/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Marikina/)).not.toBeInTheDocument()
  })

  it("turns the one number into the chat apps that were ticked", () => {
    render(
      <BusinessFooter
        business={business({
          mobile_number: "09171234567",
          chat_apps: ["viber", "whatsapp"],
        })}
      />
    )

    // The number is asked for once and reused, rather than collected per app.
    expect(screen.getByRole("link", { name: /Viber/ })).toHaveAttribute(
      "href",
      "viber://chat?number=+639171234567"
    )
    expect(screen.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
      "href",
      "https://wa.me/639171234567"
    )
    expect(screen.queryByRole("link", { name: /Telegram/ })).not.toBeInTheDocument()
  })

  it("offers no chat buttons without a number to send them to", () => {
    render(
      <BusinessFooter
        business={business({ mobile_number: null, chat_apps: ["viber"] })}
      />
    )
    expect(screen.queryByRole("link", { name: /Viber/ })).not.toBeInTheDocument()
  })

  it("opens outside links in a new tab, safely", () => {
    render(
      <BusinessFooter
        business={business({ website_url: "https://shopee.ph/nena" })}
      />
    )
    const link = screen.getByRole("link", { name: /Website/ })
    expect(link).toHaveAttribute("target", "_blank")
    // Without noopener the opened page can reach back through window.opener.
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("keeps a tel: link in the same tab", () => {
    render(<BusinessFooter business={business({ mobile_number: "09171234567" })} />)
    const link = screen.getByRole("link", { name: /09171234567/ })
    expect(link).not.toHaveAttribute("target")
  })
})

describe("BusinessHeader", () => {
  it("renders nothing rather than an empty banner", () => {
    // Most rakets fill this in over time; an empty box above every booking
    // page would be worse than the compact header that was there before.
    const { container } = render(
      <BusinessHeader business={business()} fallbackName="Gupit ni Nena" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("falls back to the calendar's name when the business has none", () => {
    render(
      <BusinessHeader
        business={business({ tagline: "Home salon sa Marikina" })}
        fallbackName="Gupit ni Nena"
      />
    )
    expect(screen.getByText("Gupit ni Nena")).toBeInTheDocument()
    expect(screen.getByText("Home salon sa Marikina")).toBeInTheDocument()
  })

  it("prefers the business name once there is one", () => {
    render(
      <BusinessHeader
        business={business({ business_name: "Salon ni Nena" })}
        fallbackName="Gupit ni Nena"
      />
    )
    expect(screen.getByText("Salon ni Nena")).toBeInTheDocument()
    expect(screen.queryByText("Gupit ni Nena")).not.toBeInTheDocument()
  })

  it("shows initials until there is a logo", () => {
    render(
      <BusinessHeader
        business={business({ business_name: "Salon ni Nena" })}
        fallbackName="x"
      />
    )
    expect(screen.getByText("SN")).toBeInTheDocument()
  })
})

describe("the landmark, now that it is a paragraph", () => {
  it("keeps the line breaks the owner typed", () => {
    render(
      <BusinessFooter
        business={business({
          barangay: "Concepcion Uno",
          landmark: "Katapat ng Mercury Drug.\nKulay dilaw na gate.",
        })}
      />
    )
    const shown = screen.getByText(/Katapat ng Mercury Drug/)
    expect(shown).toHaveClass("whitespace-pre-line")
  })

  it("is still withheld along with the rest when the address is hidden", () => {
    // The landmark names the place as precisely as the street does, so hiding
    // the address and printing "kulay dilaw na gate" would defeat the setting.
    render(
      <BusinessFooter
        business={business({
          address_visibility: "hidden",
          barangay: "Concepcion Uno",
          landmark: "Katapat ng Mercury Drug",
        })}
      />
    )
    expect(screen.queryByText(/Mercury Drug/)).not.toBeInTheDocument()
  })
})

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { BusinessFooter } from "./business-footer"
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

describe("BusinessFooter", () => {
  it("renders nothing when the business is empty", () => {
    const { container } = render(<BusinessFooter business={business()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when there is no business at all", () => {
    const { container } = render(<BusinessFooter business={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("leaves the one-line address to the header", () => {
    // Printing it in both places would be the same fact twice, and two places
    // that could disagree about the visibility setting.
    render(
      <BusinessFooter
        business={business({ ...FULL_ADDRESS, address_visibility: "full" })}
      />
    )
    expect(screen.queryByText(/Sampaguita/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Concepcion Uno/)).not.toBeInTheDocument()
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

import type { ComponentProps } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ModuleCard, accentChip, priceHint } from "@/features/marketplace/module-card"
import type { ModuleRow } from "@/lib/supabase/types"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

function makeModule(overrides: Partial<ModuleRow> = {}): ModuleRow {
  return {
    id: "booking",
    name: "Booking",
    tagline: "Take appointments online",
    description: "Let suki book a slot.",
    icon: "CalendarCheck",
    category: "sales",
    accent: "chart-1",
    is_default: true,
    is_available: true,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("priceHint", () => {
  it("reads as free when the ladder starts at zero", () => {
    expect(priceHint(0)).toBe("From free")
  })

  it("shows pesos when the cheapest tier is paid", () => {
    expect(priceHint(9900)).toMatch(/^From .*99\/mo$/)
  })

  it("stays calm when there are no tiers yet", () => {
    expect(priceHint(null)).toBe("Pricing soon")
  })
})

describe("accentChip", () => {
  it("maps the accent token to static classes Tailwind can see", () => {
    expect(accentChip("chart-3")).toBe("bg-chart-3/12 text-chart-3")
  })

  it("falls back rather than emitting an unknown class", () => {
    expect(accentChip("chart-9")).toBe("bg-chart-1/12 text-chart-1")
  })
})

describe("ModuleCard", () => {
  it("renders an available module as a link to its detail page", () => {
    render(<ModuleCard module={makeModule()} fromCentavos={0} />)

    expect(screen.getByText("Booking")).toBeInTheDocument()
    expect(screen.getByText("Take appointments online")).toBeInTheDocument()
    expect(screen.getByText("Available")).toBeInTheDocument()
    expect(screen.getByText("From free")).toBeInTheDocument()
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/marketplace/booking"
    )
  })

  it("names the tier the user is on when the module is active", () => {
    render(
      <ModuleCard
        module={makeModule()}
        fromCentavos={0}
        owned
        activeTier="Starter"
      />
    )

    expect(screen.getByText(/Active/)).toBeInTheDocument()
    expect(screen.getByText(/Starter/)).toBeInTheDocument()
    expect(screen.queryByText("Available")).toBeNull()
  })

  it("mutes a coming-soon module and does not link to it", () => {
    render(
      <ModuleCard
        module={makeModule({
          id: "delivery",
          name: "Delivery & Logistics",
          is_available: false,
        })}
        fromCentavos={null}
      />
    )

    expect(screen.getByText("Coming soon")).toBeInTheDocument()
    expect(screen.getByText("Not open yet")).toBeInTheDocument()
    expect(screen.queryByRole("link")).toBeNull()
  })
})

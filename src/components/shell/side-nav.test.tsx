import * as React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { SideNav } from "./side-nav"
import { accentChip, moduleHref, type ModuleNavItem } from "./module-nav"

const route = vi.hoisted(() => ({ pathname: "/dashboard" }))

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
}))

vi.mock("next/link", async () => {
  const react = await import("react")
  return {
    default: ({
      href,
      children,
      ...rest
    }: {
      href: string
      children: React.ReactNode
    }) => react.createElement("a", { href, ...rest }, children),
    // NavPending reads this; the real hook needs a Link ancestor from the
    // router, which a plain <a> stand-in cannot provide.
    useLinkStatus: () => ({ pending: false }),
  }
})

const MODULES: ModuleNavItem[] = [
  {
    id: "booking",
    name: "Booking",
    icon: "CalendarCheck",
    accent: "chart-1",
    tier: "Starter",
  },
  {
    id: "invoicing",
    name: "Invoices & Receipts",
    icon: "ReceiptText",
    accent: "chart-2",
    tier: "Plus",
  },
]

function renderAt(pathname: string, modules: ModuleNavItem[] = MODULES) {
  route.pathname = pathname
  return render(<SideNav modules={modules} />)
}

describe("moduleHref", () => {
  it("builds a slug URL rather than leaking a row id", () => {
    expect(moduleHref("booking")).toBe("/modules/booking")
  })
})

describe("accentChip", () => {
  it("returns whole class names Tailwind can see", () => {
    expect(accentChip("chart-3")).toBe("bg-chart-3/12 text-chart-3")
  })

  it("falls back for an unknown or missing accent", () => {
    expect(accentChip("chart-99")).toBe("bg-chart-1/12 text-chart-1")
    expect(accentChip(null)).toBe("bg-chart-1/12 text-chart-1")
  })
})

describe("SideNav modules group", () => {
  it("labels the group without making it a destination", () => {
    renderAt("/dashboard")
    const heading = screen.getByText("Modules")
    // A group heading, so it must not itself be a link.
    expect(heading.closest("a")).toBeNull()
    expect(
      screen.queryByRole("link", { name: "Modules" })
    ).not.toBeInTheDocument()
  })

  it("lists each activated module under the group", () => {
    renderAt("/dashboard")
    const group = screen.getByRole("navigation", { name: "Modules" })
    expect(
      within(group).getByRole("link", { name: /Booking/ })
    ).toHaveAttribute("href", "/modules/booking")
    expect(
      within(group).getByRole("link", { name: /Invoices & Receipts/ })
    ).toHaveAttribute("href", "/modules/invoicing")
  })

  it("marks the module you are viewing", () => {
    renderAt("/modules/booking")
    const group = screen.getByRole("navigation", { name: "Modules" })
    expect(within(group).getByRole("link", { name: /Booking/ })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(
      within(group).getByRole("link", { name: /Invoices & Receipts/ })
    ).not.toHaveAttribute("aria-current")
  })

  it("explains itself when the user owns nothing yet", () => {
    renderAt("/dashboard", [])
    expect(screen.getByText("No modules yet.")).toBeInTheDocument()
  })

  it("does not offer an 'Add a module' shortcut", () => {
    renderAt("/dashboard")
    expect(screen.queryByText("Add a module")).not.toBeInTheDocument()
  })
})

describe("SideNav primary navigation", () => {
  it("uses the full labels the sidebar has room for", () => {
    renderAt("/dashboard")
    const primary = screen.getByRole("navigation", { name: "Primary" })
    expect(
      within(primary).getByRole("link", { name: "Build your Raket" })
    ).toHaveAttribute("href", "/raket")
    expect(
      within(primary).getByRole("link", { name: "Raket Market" })
    ).toHaveAttribute("href", "/marketplace")
  })

  it("keeps a module route from activating the Raket tab", () => {
    renderAt("/modules/booking")
    const primary = screen.getByRole("navigation", { name: "Primary" })
    expect(
      within(primary).getByRole("link", { name: "Build your Raket" })
    ).not.toHaveAttribute("aria-current")
  })
})

describe("module pages, and folding them away", () => {
  const withBooking: ModuleNavItem[] = [
    { id: "booking", name: "Booking", icon: "CalendarCheck", accent: "chart-1", tier: null },
  ]

  it("lists a module's pages beneath it by default", () => {
    // Hiding them until someone finds the chevron would hide the feature.
    renderAt("/modules/booking", withBooking)
    expect(screen.getByRole("link", { name: /Booked/ })).toBeInTheDocument()
  })

  it("folds them away and back", async () => {
    const user = userEvent.setup()
    renderAt("/modules/booking", withBooking)

    const toggle = screen.getByRole("button", { name: /mga pahina ng Booking/ })
    expect(toggle).toHaveAttribute("aria-expanded", "true")

    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("link", { name: /Booked/ })).not.toBeInTheDocument()

    await user.click(toggle)
    expect(screen.getByRole("link", { name: /Booked/ })).toBeInTheDocument()
  })

  it("gives a module with no pages nothing to fold", () => {
    renderAt("/modules/invoicing")
    expect(
      screen.queryByRole("button", { name: /mga pahina ng Invoices/ })
    ).not.toBeInTheDocument()
  })

  it("hands the highlight to the page, not the module", () => {
    renderAt("/modules/booking/booked", withBooking)

    const child = screen.getByRole("link", { name: /Booked/ })
    expect(child).toHaveAttribute("aria-current", "page")
    // Otherwise both would light up and "you are here" would stop meaning it.
    expect(screen.getByRole("link", { name: /^Booking/ })).not.toHaveAttribute(
      "aria-current"
    )
  })

  it("keeps the module highlighted on its own pages", () => {
    renderAt("/modules/booking", withBooking)
    expect(screen.getByRole("link", { name: /^Booking/ })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })
})

describe("the raket's own sub-navigation", () => {
  it("offers My raket parts under Build your Raket", () => {
    renderAt("/dashboard")
    const parts = screen.getByRole("link", { name: /My raket parts/ })
    expect(parts).toHaveAttribute("href", "/raket/parts")
  })

  it("lights the child, not the parent, on the parts page", () => {
    // A highlight covering two rows stops meaning "you are here".
    renderAt("/raket/parts")
    expect(
      screen.getByRole("link", { name: /My raket parts/ })
    ).toHaveAttribute("aria-current", "page")
    expect(
      screen.getByRole("link", { name: "Build your Raket" })
    ).not.toHaveAttribute("aria-current")
  })

  it("lights the parent alone on the board itself", () => {
    renderAt("/raket")
    expect(
      screen.getByRole("link", { name: "Build your Raket" })
    ).toHaveAttribute("aria-current", "page")
    expect(
      screen.getByRole("link", { name: /My raket parts/ })
    ).not.toHaveAttribute("aria-current")
  })
})

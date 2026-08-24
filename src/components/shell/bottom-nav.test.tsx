import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { BottomNav, isNavItemActive, NAV_ITEMS } from "./bottom-nav"

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

function renderAt(pathname: string) {
  route.pathname = pathname
  return render(<BottomNav />)
}

describe("isNavItemActive", () => {
  it("matches the exact route", () => {
    expect(isNavItemActive("/dashboard", "/dashboard")).toBe(true)
  })

  it("matches nested routes", () => {
    expect(isNavItemActive("/raket/abc-123", "/raket")).toBe(true)
    expect(isNavItemActive("/marketplace/booking", "/marketplace")).toBe(true)
  })

  it("ignores a trailing slash", () => {
    expect(isNavItemActive("/account/", "/account")).toBe(true)
  })

  it("does not match a route that merely shares a prefix", () => {
    expect(isNavItemActive("/raketship", "/raket")).toBe(false)
    expect(isNavItemActive("/accounts", "/account")).toBe(false)
  })

  it("does not match a different section", () => {
    expect(isNavItemActive("/marketplace", "/raket")).toBe(false)
  })

  it("handles an empty pathname", () => {
    expect(isNavItemActive("", "/dashboard")).toBe(false)
  })
})

describe("BottomNav", () => {
  it("renders every destination once", () => {
    renderAt("/dashboard")
    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(NAV_ITEMS.length)
    expect(links.map((l) => l.getAttribute("href"))).toEqual(
      NAV_ITEMS.map((i) => i.href)
    )
  })

  it("marks only the current tab with aria-current", () => {
    renderAt("/dashboard")
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.getByRole("link", { name: "Raket" })).not.toHaveAttribute(
      "aria-current"
    )
  })

  it("keeps the parent tab active on nested routes", () => {
    renderAt("/raket/abc-123")
    expect(screen.getByRole("link", { name: "Raket" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current"
    )
  })

  it("activates Market on a module detail route", () => {
    renderAt("/marketplace/booking")
    expect(screen.getByRole("link", { name: "Market" })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  it("leaves every tab inactive on an unrelated route", () => {
    renderAt("/login")
    for (const item of NAV_ITEMS) {
      expect(
        screen.getByRole("link", { name: item.shortLabel ?? item.label })
      ).not.toHaveAttribute("aria-current")
    }
  })

  it("labels the landmark for screen readers", () => {
    renderAt("/dashboard")
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeVisible()
  })
})

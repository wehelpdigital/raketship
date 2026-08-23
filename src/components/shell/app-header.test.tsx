import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AppHeader, initialsFrom, pageTitleFor } from "./app-header"

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
  }
})

// Keeps next/headers and the Supabase SDK out of the test run.
vi.mock("@/features/auth/actions", () => ({
  signOut: vi.fn(),
}))

function renderAt(pathname: string) {
  route.pathname = pathname
  return render(<AppHeader name="Juan dela Cruz" email="juan@raket.ph" />)
}

describe("pageTitleFor", () => {
  it("names each section", () => {
    expect(pageTitleFor("/dashboard")).toBe("Home")
    expect(pageTitleFor("/raket")).toBe("Build your Raket")
    expect(pageTitleFor("/marketplace")).toBe("Marketplace")
    expect(pageTitleFor("/account")).toBe("Account")
  })

  it("keeps the section title on nested routes", () => {
    expect(pageTitleFor("/raket/abc-123")).toBe("Build your Raket")
    expect(pageTitleFor("/marketplace/booking")).toBe("Marketplace")
  })

  it("is empty outside the app sections", () => {
    expect(pageTitleFor("/login")).toBe("")
    expect(pageTitleFor("/raketship")).toBe("")
    expect(pageTitleFor("")).toBe("")
  })
})

describe("initialsFrom", () => {
  it("takes the first two words of a name", () => {
    expect(initialsFrom("Juan dela Cruz")).toBe("JD")
    expect(initialsFrom("  Nena   Reyes  ")).toBe("NR")
  })

  it("handles a single word", () => {
    expect(initialsFrom("Nena")).toBe("N")
  })

  it("falls back to the email when there is no name", () => {
    expect(initialsFrom(null, "vet@raket.ph")).toBe("V")
    expect(initialsFrom("   ", "vet@raket.ph")).toBe("V")
  })

  it("falls back to the brand letter when it knows nothing", () => {
    expect(initialsFrom(null, null)).toBe("R")
    expect(initialsFrom(undefined, undefined)).toBe("R")
  })
})

describe("AppHeader", () => {
  it("gives the page a single h1 naming the section", () => {
    renderAt("/account")
    const headings = screen.getAllByRole("heading", { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent("Account")
  })

  it("omits the section heading outside the app sections", () => {
    renderAt("/somewhere-else")
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
  })

  it("shows the signed-in person's initials", () => {
    renderAt("/dashboard")
    expect(screen.getByText("JD")).toBeVisible()
  })

  it("offers the inline navigation and the brand mark", () => {
    renderAt("/dashboard")
    const hrefs = screen.getAllByRole("link").map((l) => l.getAttribute("href"))
    expect(hrefs).toEqual([
      "/dashboard",
      "/dashboard",
      "/raket",
      "/marketplace",
      "/account",
    ])
  })

  it("marks the current section in the inline navigation", () => {
    renderAt("/marketplace/booking")
    expect(screen.getByRole("link", { name: "Market" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current"
    )
  })
})

import * as React from "react"
import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { RouteTransition } from "./route-transition"

const route = vi.hoisted(() => ({ pathname: "/dashboard" }))

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
}))

/** The overlay only appears after its delay, so tests drive the clock. */
function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function clickLink(attrs: Record<string, string>, init: MouseEventInit = {}) {
  const a = document.createElement("a")
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v)
  a.textContent = "go"
  document.body.appendChild(a)
  act(() => {
    a.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init })
    )
  })
  return a
}

const overlay = () => screen.queryByText("Loading…")

beforeEach(() => {
  vi.useFakeTimers()
  route.pathname = "/dashboard"
  window.history.replaceState({}, "", "/dashboard")
})

afterEach(() => {
  vi.useRealTimers()
  document.body.querySelectorAll("a").forEach((a) => a.remove())
})

describe("RouteTransition", () => {
  it("stays out of the way until a navigation is actually slow", () => {
    render(<RouteTransition />)
    clickLink({ href: "/marketplace" })

    // Immediately after the click there is nothing to see — a fast navigation
    // should never flash a spinner.
    expect(overlay()).not.toBeInTheDocument()

    tick(250)
    expect(overlay()).toBeInTheDocument()
  })

  it("clears once the pathname changes", () => {
    const { rerender } = render(<RouteTransition />)
    clickLink({ href: "/marketplace" })
    tick(250)
    expect(overlay()).toBeInTheDocument()

    // Arriving is the completion signal.
    route.pathname = "/marketplace"
    rerender(<RouteTransition />)
    expect(overlay()).not.toBeInTheDocument()
  })

  it("gives up rather than hanging forever on a cancelled navigation", () => {
    render(<RouteTransition />)
    clickLink({ href: "/marketplace" })
    tick(250)
    expect(overlay()).toBeInTheDocument()

    tick(8000)
    expect(overlay()).not.toBeInTheDocument()
  })

  it("ignores a link to the page we are already on", () => {
    render(<RouteTransition />)
    // Nothing would ever change, so nothing would ever hide the overlay.
    clickLink({ href: "/dashboard" })
    tick(500)
    expect(overlay()).not.toBeInTheDocument()
  })

  it("ignores hashes, new tabs, downloads and opt-outs", () => {
    render(<RouteTransition />)

    clickLink({ href: "#section" })
    clickLink({ href: "/marketplace", target: "_blank" })
    clickLink({ href: "/report.pdf", download: "" })
    clickLink({ href: "/marketplace", "data-no-transition": "" })

    tick(500)
    expect(overlay()).not.toBeInTheDocument()
  })

  it("ignores external links", () => {
    render(<RouteTransition />)
    clickLink({ href: "https://example.com/somewhere" })
    tick(500)
    expect(overlay()).not.toBeInTheDocument()
  })

  it("ignores modified clicks, which open a tab rather than navigate", () => {
    render(<RouteTransition />)
    clickLink({ href: "/marketplace" }, { metaKey: true })
    clickLink({ href: "/marketplace" }, { ctrlKey: true })
    clickLink({ href: "/marketplace" }, { shiftKey: true })
    tick(500)
    expect(overlay()).not.toBeInTheDocument()
  })

  it("ignores middle-click", () => {
    render(<RouteTransition />)
    clickLink({ href: "/marketplace" }, { button: 1 })
    tick(500)
    expect(overlay()).not.toBeInTheDocument()
  })

  it("announces itself to assistive technology while busy", () => {
    render(<RouteTransition />)
    clickLink({ href: "/marketplace" })
    tick(250)
    const status = screen.getByRole("status")
    expect(status).toHaveAttribute("aria-busy", "true")
  })
})

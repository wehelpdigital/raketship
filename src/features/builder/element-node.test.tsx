import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import {
  ElementCard,
  ElementNode,
  accentChipClass,
} from "@/features/builder/element-node"

describe("a module card with a glance", () => {
  const glance = {
    lines: ["2 calendar · 1 live", "5 paparating na booking"],
    live: true,
  }

  it("shows the module's own numbers instead of the stock sentence", () => {
    render(
      <ElementCard nodeType="module" values={{ label: "Booking" }} glance={glance} />
    )

    expect(screen.getByText("2 calendar · 1 live")).toBeInTheDocument()
    expect(screen.getByText("5 paparating na booking")).toBeInTheDocument()
    expect(
      screen.queryByText(/A feature you activated/)
    ).not.toBeInTheDocument()
  })

  it("wears the live mark only while something is live", () => {
    const { container, rerender } = render(
      <ElementCard nodeType="module" values={{}} glance={glance} />
    )
    expect(container.querySelector(".live-dot")).toBeInTheDocument()

    rerender(
      <ElementCard
        nodeType="module"
        values={{}}
        glance={{ ...glance, live: false }}
      />
    )
    expect(container.querySelector(".live-dot")).not.toBeInTheDocument()
  })

  it("paints the chosen palette as swatches, inline", () => {
    // The swatch IS the colour — the one inline-style exception.
    const { container } = render(
      <ElementCard
        nodeType="module"
        values={{}}
        glance={{
          lines: ["Gupit ni Nena", "Tema: Dagat"],
          live: false,
          logoName: "GN",
          swatches: ["oklch(0.48 0.113 245)", "oklch(0.9 0.05 245)"],
        }}
      />
    )

    const dots = [...container.querySelectorAll("[style]")].filter((el) =>
      el.getAttribute("style")?.includes("background-color")
    )
    expect(dots).toHaveLength(2)
  })

  it("shows the shop's initials when there is a profile but no logo", () => {
    render(
      <ElementCard
        nodeType="module"
        values={{}}
        glance={{
          lines: ["Gupit ni Nena", "Tema: Dagat"],
          live: false,
          logoName: "Gupit ni Nena",
          logoUrl: null,
        }}
      />
    )
    expect(screen.getByText("GN")).toBeInTheDocument()
  })

  it("arrives in turn, not all at once", () => {
    const { container } = render(
      <ElementCard nodeType="module" values={{}} glance={glance} enterIndex={3} />
    )
    const card = container.querySelector("[data-slot=element-card]")
    expect(card?.className).toContain("node-arrive")
    expect(card?.getAttribute("style")).toContain("210ms")
  })

  it("arrives without ceremony when it has no place in the stagger", () => {
    const { container } = render(<ElementCard nodeType="timer" values={{}} />)
    const card = container.querySelector("[data-slot=element-card]")
    expect(card?.className).not.toContain("node-arrive")
  })
})

describe("ElementCard", () => {
  it("renders the step label and its one-line summary", () => {
    render(
      <ElementCard
        nodeType="timer"
        values={{ delayValue: 2, delayUnit: "hours" }}
      />
    )

    // The label and the category badge both read "Wait" — check each in place.
    expect(screen.getByText("Wait", { selector: "p" })).toBeInTheDocument()
    expect(screen.getByText("Wait", { selector: "span" })).toBeInTheDocument()
    expect(screen.getByText("Wait 2 hours after booking")).toBeInTheDocument()
  })

  it("prefers a label the owner typed", () => {
    render(
      <ElementCard nodeType="email" values={{ label: "Salamat email" }} />
    )

    expect(screen.getByText("Salamat email")).toBeInTheDocument()
  })

  it("shows a lock and an upgrade hint when the element is locked", () => {
    render(<ElementCard nodeType="sms" values={{}} locked />)

    expect(screen.getByLabelText("Locked")).toBeInTheDocument()
    expect(screen.getByText("Upgrade to use")).toBeInTheDocument()
  })

  it("stays quiet about locking when the element is available", () => {
    render(<ElementCard nodeType="sms" values={{}} />)

    expect(screen.queryByLabelText("Locked")).not.toBeInTheDocument()
    expect(screen.queryByText("Upgrade to use")).not.toBeInTheDocument()
  })

  it("invites a tap on a module node", () => {
    render(
      <ElementCard nodeType="module" values={{ label: "Booking", tier: "starter" }} />
    )

    expect(screen.getByText("Tap to open")).toBeInTheDocument()
    expect(screen.getByText("Starter")).toBeInTheDocument()
  })

  it("marks the selected card with a ring", () => {
    const { container } = render(
      <ElementCard nodeType="timer" values={{}} selected />
    )
    const card = container.querySelector('[data-slot="element-card"]')

    expect(card?.className).toContain("ring-primary")
  })

  it("does not fall over on an element the registry has never heard of", () => {
    render(<ElementCard nodeType="teleporter" values={{}} />)

    expect(screen.getByText("teleporter")).toBeInTheDocument()
  })
})

describe("accentChipClass", () => {
  it("maps each accent to a static class pair", () => {
    expect(accentChipClass("chart-2")).toContain("text-chart-2")
    expect(accentChipClass("chart-5")).toContain("bg-chart-5")
  })

  it("falls back to the first accent for anything unknown", () => {
    expect(accentChipClass("chart-99")).toBe(accentChipClass("chart-1"))
  })
})

describe("ElementNode", () => {
  it("is registered as a React Flow renderer", () => {
    expect(typeof ElementNode).toBe("function")
  })
})

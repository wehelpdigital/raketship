import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import {
  ElementCard,
  ElementNode,
  accentChipClass,
} from "@/features/builder/element-node"

describe("the module's own dress", () => {
  it("draws the accent line down the left edge", () => {
    const { container } = render(
      <ElementCard nodeType="module" values={{}} accent="chart-3" />
    )
    const edge = container.querySelector("[aria-hidden]")
    expect(edge?.className).toContain("from-chart-3")
    expect(edge?.className).toContain("left-0")
  })

  it("wears the shop's colour on the start card's edge", () => {
    const { container } = render(<ElementCard nodeType="start" values={{}} />)
    const edge = container.querySelector("[aria-hidden]")
    expect(edge?.className).toContain("from-primary")
  })

  it("wears the module's own icon, not the generic box", () => {
    const { container } = render(
      <ElementCard nodeType="module" values={{}} icon="CalendarCheck" />
    )
    expect(container.querySelector(".lucide-calendar-check")).toBeInTheDocument()
    expect(container.querySelector(".lucide-boxes")).not.toBeInTheDocument()
  })

  it("keeps the generic box when the catalog has nothing better", () => {
    const { container } = render(<ElementCard nodeType="module" values={{}} />)
    expect(container.querySelector(".lucide-boxes")).toBeInTheDocument()
  })

  it("moves the start card's badge up under its name", () => {
    const { container } = render(
      <ElementCard
        nodeType="start"
        values={{ label: "Salon ni Nena" }}
        glance={{ lines: [], live: false, logoName: "Salon ni Nena", tagline: "Gupit at kulay." }}
      />
    )

    const badge = screen.getByText("Business")
    const name = screen.getByText("Salon ni Nena")
    // Same column as the name, not the footer row.
    expect(badge.parentElement).toBe(name.closest("[class*=min-w-0]"))
    // And the footer is gone entirely — nothing else lived there.
    expect(container.textContent).not.toContain("Tap to open")
  })
})

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

  it("gives the tagline room for a second line, unlike the facts", () => {
    // Facts truncate; prose cut mid-word reads as a mistake.
    const { container } = render(
      <ElementCard
        nodeType="start"
        values={{ label: "Gupit ni Nena" }}
        glance={{
          lines: [],
          live: false,
          logoName: "Gupit ni Nena",
          tagline: "Gupit, kulay at rebond sa puso ng QC.",
        }}
      />
    )

    const tagline = [...container.querySelectorAll("p")].find((el) =>
      el.textContent?.includes("rebond")
    )
    expect(tagline?.className).toContain("line-clamp-2")
    expect(tagline?.className).not.toContain("truncate")
  })

  it("shows the shop's initials when there is a profile but no logo", () => {
    render(
      <ElementCard
        nodeType="module"
        values={{}}
        glance={{
          lines: [],
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

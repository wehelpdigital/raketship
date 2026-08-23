import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import {
  ElementCard,
  ElementNode,
  accentChipClass,
} from "@/features/builder/element-node"

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

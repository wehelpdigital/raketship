import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

function threeTabs() {
  return render(
    <Tabs defaultValue="a">
      <TabsList>
        <TabsTrigger value="a">A</TabsTrigger>
        <TabsTrigger value="b">B</TabsTrigger>
      </TabsList>
      <TabsContent value="a" keepMounted>
        panel a
      </TabsContent>
      <TabsContent value="b" keepMounted>
        panel b
      </TabsContent>
    </Tabs>
  )
}

describe("Tabs", () => {
  it("stacks the list above the panel", () => {
    const { container } = threeTabs()
    // The orientation variants must target data-[orientation=…]; Base UI never
    // emits a bare data-horizontal, so the boolean form matches nothing.
    const root = container.querySelector('[data-slot="tabs"]')
    expect(root).toHaveAttribute("data-orientation", "horizontal")
    expect(root?.className).toContain("data-[orientation=horizontal]:flex-col")
  })

  it("carries the enter transition on every panel", () => {
    const { container } = threeTabs()
    for (const panel of container.querySelectorAll('[data-slot="tabs-content"]')) {
      expect(panel.className).toContain("data-starting-style:opacity-0")
      expect(panel.className).toContain("transition-[opacity,translate]")
      // Honour a reduced-motion preference rather than animating regardless.
      expect(panel.className).toContain("motion-reduce:transition-none")
    }
  })

  it("marks the panel it just revealed so the transition can run", async () => {
    const user = userEvent.setup()
    const { container } = threeTabs()

    await user.click(screen.getByRole("tab", { name: "B" }))

    const panels = Array.from(
      container.querySelectorAll('[data-slot="tabs-content"]')
    )
    // The one that appeared gets the starting-style hook for a frame; the one
    // that left is hidden outright.
    expect(panels[1]).toHaveAttribute("data-starting-style")
    expect(panels[0]).toHaveAttribute("hidden")
  })

  it("keeps hidden panels mounted so their state survives a switch", async () => {
    const user = userEvent.setup()
    const { container } = threeTabs()

    await user.click(screen.getByRole("tab", { name: "B" }))
    // Both are still in the tree — losing a half-filled form on a tab change
    // is the bug keepMounted exists to prevent.
    expect(
      container.querySelectorAll('[data-slot="tabs-content"]')
    ).toHaveLength(2)
    expect(screen.getByText("panel a")).toBeInTheDocument()
  })
})

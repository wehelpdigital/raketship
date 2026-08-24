import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ZonePicker } from "./zone-picker"
import { zoneMatches } from "@/lib/booking/timezones"

const OPTIONS = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Pacific/Auckland",
  "UTC",
]

function renderPicker(overrides: Partial<React.ComponentProps<typeof ZonePicker>> = {}) {
  const onChange = vi.fn()
  render(
    <ZonePicker
      value="Asia/Manila"
      options={OPTIONS}
      calendarZone="Asia/Manila"
      calendarLabel="Manila · GMT+8"
      onChange={onChange}
      {...overrides}
    />
  )
  return { onChange }
}

describe("zoneMatches", () => {
  it("finds a city without needing the IANA spelling", () => {
    // Nobody types the underscore.
    expect(zoneMatches("Asia/Hong_Kong", "hong kong")).toBe(true)
    expect(zoneMatches("America/New_York", "new york")).toBe(true)
  })

  it("matches on the region as well as the city", () => {
    expect(zoneMatches("Asia/Manila", "asia")).toBe(true)
    expect(zoneMatches("Asia/Manila", "manila")).toBe(true)
  })

  it("requires every word, so a second word narrows rather than widens", () => {
    expect(zoneMatches("America/New_York", "new york")).toBe(true)
    expect(zoneMatches("America/New_York", "new tokyo")).toBe(false)
  })

  it("treats an empty query as matching everything", () => {
    expect(zoneMatches("Asia/Manila", "   ")).toBe(true)
  })
})

describe("ZonePicker", () => {
  it("sits at rest as a tag, not an open control", () => {
    renderPicker()
    // The city and its offset are readable without opening anything.
    expect(screen.getByRole("button", { name: /Manila/ })).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("opens a searchable list when tapped", async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole("button", { name: /Manila/ }))

    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByLabelText("Hanapin ang timezone")).toBeInTheDocument()
  })

  it("narrows the list as you type", async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole("button", { name: /Manila/ }))
    const search = await screen.findByLabelText("Hanapin ang timezone")
    await user.type(search, "auckland")

    expect(screen.getByText("Auckland")).toBeInTheDocument()
    expect(screen.queryByText("Singapore")).not.toBeInTheDocument()
  })

  it("reports when nothing matches instead of showing an empty box", async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole("button", { name: /Manila/ }))
    await user.type(
      await screen.findByLabelText("Hanapin ang timezone"),
      "atlantis"
    )

    expect(screen.getByText(/Walang tugma/)).toBeInTheDocument()
  })

  it("hands back the chosen zone and closes", async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker()

    await user.click(screen.getByRole("button", { name: /Manila/ }))
    await user.click(await screen.findByRole("button", { name: /London/ }))

    expect(onChange).toHaveBeenCalledWith("Europe/London")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("marks the shop's own zone so whose clock is whose stays clear", async () => {
    const user = userEvent.setup()
    renderPicker({ value: "Europe/London", calendarZone: "Asia/Manila" })

    await user.click(screen.getByRole("button", { name: /London/ }))
    expect(await screen.findByText("oras ng shop")).toBeInTheDocument()
  })

  it("labels itself on the tag, without a caption above or below it", () => {
    renderPicker({ value: "Europe/London", calendarZone: "Asia/Manila" })
    const tag = screen.getByRole("button", { name: /London/ })
    // The tag says what it is, so the surrounding label and helper line that
    // repeated it are gone.
    expect(tag).toHaveTextContent("Ang iyong timezone")
    expect(tag).toHaveTextContent("London")
    expect(screen.queryByText("Oras na ipinapakita")).not.toBeInTheDocument()
    expect(screen.queryByText(/Sa oras ng shop/)).not.toBeInTheDocument()
  })

  it("keeps the shop's own zone findable in the dialog copy", async () => {
    const user = userEvent.setup()
    renderPicker({ value: "Europe/London", calendarZone: "Asia/Manila" })

    await user.click(screen.getByRole("button", { name: /London/ }))
    // Removed from the page, but a customer comparing zones can still see it.
    // Matched with a substring rather than a regex: "GMT+8" contains a plus,
    // which a regex would read as a quantifier.
    expect(
      await screen.findByText((text) => text.includes("Manila · GMT+8"))
    ).toBeInTheDocument()
  })
})

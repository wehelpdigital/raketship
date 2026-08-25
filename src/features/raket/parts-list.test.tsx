import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PartsList, type PartRow } from "./parts-list"

const setClientManager = vi.fn()
const setWebsite = vi.fn()
const setProductCatalog = vi.fn()
const activateModule = vi.fn()
const deactivateModule = vi.fn()
const setModuleTier = vi.fn()

vi.mock("@/features/raket/addons", () => ({
  setClientManager: (...args: unknown[]) => setClientManager(...args),
  setWebsite: (...args: unknown[]) => setWebsite(...args),
  setProductCatalog: (...args: unknown[]) => setProductCatalog(...args),
}))
vi.mock("@/features/marketplace/actions", () => ({
  activateModule: (...args: unknown[]) => activateModule(...args),
  deactivateModule: (...args: unknown[]) => deactivateModule(...args),
  setModuleTier: (...args: unknown[]) => setModuleTier(...args),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function row(overrides: Partial<PartRow> = {}): PartRow {
  return {
    id: "booking",
    name: "Booking",
    tagline: "Take appointments online",
    icon: "CalendarCheck",
    accent: "chart-1",
    isDefault: true,
    active: true,
    tierId: "t1",
    tiers: [
      { id: "t1", name: "Starter", priceCentavos: 0, level: 1 },
      { id: "t2", name: "Plus", priceCentavos: 14900, level: 2 },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  setClientManager.mockResolvedValue({ ok: true })
  setWebsite.mockResolvedValue({ ok: true })
  setProductCatalog.mockResolvedValue({ ok: true })
  activateModule.mockResolvedValue({ ok: true })
  deactivateModule.mockResolvedValue({ ok: true })
  setModuleTier.mockResolvedValue({ ok: true })
})

describe("PartsList", () => {
  it("lets the Client Manager's switch speak alone — no Bukas beside it", () => {
    render(
      <PartsList
        rows={[
          row({
            id: "client-manager",
            name: "Client Manager",
            isDefault: false,
            active: true,
            tierId: null,
            tiers: [],
          }),
        ]}
      />
    )

    expect(screen.getByRole("switch")).toBeChecked()
    expect(screen.queryByText("Bukas")).not.toBeInTheDocument()
    expect(screen.queryByText("Sarado")).not.toBeInTheDocument()
  })

  it("wears the tier as a tag in its own column", () => {
    render(<PartsList rows={[row()]} />)

    const tag = screen.getByText("Starter", { selector: "span" })
    expect(tag.className).toContain("rounded-full")
    // Its own column: the title cluster no longer whispers the tier.
    const titleCluster = screen
      .getByText("Booking")
      .closest("[class*='flex-1']")
    expect(titleCluster?.textContent).not.toContain("Starter")
  })

  it("gives a default module no controls and no badge — being here IS the statement", () => {
    render(<PartsList rows={[row()]} />)

    expect(screen.queryByText("Kasama lagi")).not.toBeInTheDocument()
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(screen.queryByText("Alisin")).not.toBeInTheDocument()
    // The ladder select is gone too — upgrading is the marketplace's
    // conversation, with prices and features in front of it.
    expect(screen.queryByText("Starter — Libre")).not.toBeInTheDocument()
    expect(setModuleTier).not.toHaveBeenCalled()
  })

  it("stripes every second row like a ledger", () => {
    const { container } = render(
      <PartsList
        rows={[
          row(),
          row({ id: "client-manager", name: "Client Manager", isDefault: false, tiers: [], tierId: null }),
        ]}
      />
    )

    const rows = container.querySelectorAll("[class*='even:bg-muted']")
    expect(rows.length).toBe(2)
    const card = container.firstElementChild
    expect(card?.className).toContain("divide-y")
    expect(card?.className).toContain("rounded-lg")
  })

  it("switches the Website the slot-free way, off Booking's path entirely", async () => {
    const user = userEvent.setup()
    render(
      <PartsList
        rows={[
          row({
            id: "website",
            name: "Website",
            isDefault: false,
            active: false,
            tierId: null,
            tiers: [],
          }),
        ]}
      />
    )

    await user.click(screen.getByRole("switch", { name: "Website" }))

    await waitFor(() => expect(setWebsite).toHaveBeenCalledWith(true))
    expect(activateModule).not.toHaveBeenCalled()
    expect(setClientManager).not.toHaveBeenCalled()
  })

  it("switches the Client Manager the slot-free way", async () => {
    const user = userEvent.setup()
    render(
      <PartsList
        rows={[
          row({
            id: "client-manager",
            name: "Client Manager",
            isDefault: false,
            active: false,
            tierId: null,
            tiers: [],
          }),
        ]}
      />
    )

    await user.click(screen.getByRole("switch", { name: "Client Manager" }))

    await waitFor(() => expect(setClientManager).toHaveBeenCalledWith(true))
    expect(activateModule).not.toHaveBeenCalled()
  })

  it("activates everything else through the marketplace, slots and all", async () => {
    const user = userEvent.setup()
    render(
      <PartsList
        rows={[
          row({
            id: "invoicing",
            name: "Invoices",
            isDefault: false,
            active: false,
            tierId: null,
            tiers: [],
          }),
        ]}
      />
    )

    await user.click(screen.getByRole("button", { name: "I-activate" }))

    await waitFor(() =>
      expect(activateModule).toHaveBeenCalledWith("invoicing")
    )
  })

  it("offers Alisin only on a non-default module that is on", async () => {
    const user = userEvent.setup()
    render(
      <PartsList
        rows={[
          row({
            id: "invoicing",
            name: "Invoices",
            isDefault: false,
            active: true,
            tiers: [],
            tierId: null,
          }),
        ]}
      />
    )

    await user.click(screen.getByRole("button", { name: "Alisin" }))
    await waitFor(() =>
      expect(deactivateModule).toHaveBeenCalledWith("invoicing")
    )
  })

})

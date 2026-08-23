import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { PlanPicker } from "@/features/marketplace/plan-picker"
import type { PlanRow } from "@/lib/supabase/types"

vi.mock("@/features/marketplace/actions", () => ({ changePlan: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function makePlan(overrides: Partial<PlanRow> = {}): PlanRow {
  return {
    id: "free",
    name: "Libre",
    tagline: "Start without paying",
    description: null,
    price_centavos: 0,
    billing_period: "month",
    features: ["One module at a time"],
    module_slots: 1,
    sort_order: 0,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

const BASIC = makePlan({
  id: "basic",
  name: "Basic",
  tagline: "For a raket that's growing",
  price_centavos: 29900,
  module_slots: 5,
  sort_order: 1,
})

describe("PlanPicker", () => {
  it("renders nothing before the plans have landed", () => {
    const { container } = render(
      <PlanPicker plans={[]} currentPlanId={null} activeModuleCount={0} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("marks the plan the user is on and does not offer it again", () => {
    render(
      <PlanPicker
        plans={[makePlan(), BASIC]}
        currentPlanId="free"
        activeModuleCount={1}
      />
    )

    expect(screen.getByText("Your plan")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "You're on Libre" })
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Upgrade to Basic" })
    ).toBeEnabled()
  })

  it("explains a downgrade that would not fit before it is attempted", () => {
    render(
      <PlanPicker
        plans={[makePlan(), BASIC]}
        currentPlanId="basic"
        activeModuleCount={3}
      />
    )

    expect(
      screen.getByText(/You have 3 modules running\. Remove 2 to fit on Libre\./)
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Switch to Libre" })
    ).toBeDisabled()
  })

  it("survives a features column that is not a list of strings", () => {
    const broken = makePlan({
      features: { nope: true } as unknown as string[],
    })

    expect(() =>
      render(
        <PlanPicker
          plans={[broken]}
          currentPlanId={null}
          activeModuleCount={0}
        />
      )
    ).not.toThrow()
  })
})

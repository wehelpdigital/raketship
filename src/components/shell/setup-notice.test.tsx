import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { SetupNotice } from "./setup-notice"

describe("SetupNotice", () => {
  it("names the env vars a fresh checkout is missing", () => {
    render(<SetupNotice reason="unconfigured" />)

    expect(screen.getByRole("alert")).toHaveTextContent(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    )
    expect(screen.getByRole("alert")).toHaveTextContent(
      "NEXT_PUBLIC_SUPABASE_URL"
    )
  })

  it("switches its headline once the keys are in but the tables are not", () => {
    render(<SetupNotice reason="no-data" />)

    expect(screen.getByRole("alert")).toHaveTextContent(/still empty/i)
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      /connect your database/i
    )
  })

  it("lists the three setup steps in order", () => {
    render(<SetupNotice reason="unconfigured" />)

    const steps = screen.getAllByRole("listitem")
    expect(steps).toHaveLength(3)
    expect(steps[1]).toHaveTextContent("npm run db:push")
    expect(steps[2]).toHaveTextContent("npm run db:seed-admin")
  })

  it("defaults to the unconfigured copy when no key is present", () => {
    // The test env has no NEXT_PUBLIC_SUPABASE_* values, so supabaseConfigured
    // is false and the notice must pick the first step on its own.
    render(<SetupNotice />)

    expect(screen.getByRole("alert")).toHaveTextContent(/connect your database/i)
  })
})

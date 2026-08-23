import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ProfileForm } from "./profile-form"

// The action is a "use server" module; stub it so the test never reaches
// next/headers or the Supabase SDK.
vi.mock("@/features/account/actions", () => ({
  updateProfile: vi.fn(async () => ({ status: "idle" as const })),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe("ProfileForm", () => {
  it("shows the values it was given", () => {
    render(
      <ProfileForm
        email="juan@raket.ph"
        fullName="Juan dela Cruz"
        businessName="Nena's Bakeshop"
      />
    )

    expect(screen.getByLabelText("Your name")).toHaveValue("Juan dela Cruz")
    expect(screen.getByLabelText("Business name")).toHaveValue(
      "Nena's Bakeshop"
    )
    expect(screen.getByLabelText("Email")).toHaveValue("juan@raket.ph")
  })

  it("renders empty fields instead of crashing on a blank profile", () => {
    render(<ProfileForm email={null} fullName={null} businessName={null} />)

    expect(screen.getByLabelText("Your name")).toHaveValue("")
    expect(screen.getByLabelText("Email")).toHaveValue("")
    expect(
      screen.getByRole("button", { name: "Save changes" })
    ).toBeEnabled()
  })

  it("locks itself down when Supabase is not connected", () => {
    render(
      <ProfileForm
        email="juan@raket.ph"
        fullName="Juan dela Cruz"
        businessName={null}
        readOnly
      />
    )

    expect(screen.getByLabelText("Your name")).toBeDisabled()
    expect(screen.getByLabelText("Business name")).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Save changes" })
    ).toBeDisabled()
  })

  it("never lets the sign-in email be edited", () => {
    render(
      <ProfileForm
        email="juan@raket.ph"
        fullName="Juan dela Cruz"
        businessName={null}
      />
    )

    expect(screen.getByLabelText("Email")).toHaveAttribute("readonly")
  })
})

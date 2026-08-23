import type { ComponentProps } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { signUpWithPassword } = vi.hoisted(() => ({
  signUpWithPassword: vi.fn(),
}))

vi.mock("@/features/auth/actions", () => ({ signUpWithPassword }))

vi.mock("next/link", () => ({
  default: function MockLink({ children, ...rest }: ComponentProps<"a">) {
    return <a {...rest}>{children}</a>
  },
}))

import { RegisterForm, passwordStrength } from "@/features/auth/register-form"

beforeEach(() => {
  vi.clearAllMocks()
  signUpWithPassword.mockResolvedValue({ status: "idle" })
})

describe("passwordStrength", () => {
  it("says nothing until something is typed", () => {
    expect(passwordStrength("")).toEqual({ score: 0, label: "" })
  })

  it("calls anything under 8 characters too short", () => {
    expect(passwordStrength("abc123")).toMatchObject({ score: 1 })
    expect(passwordStrength("abc123").label).toContain("8 characters")
  })

  it("climbs as length and variety climb", () => {
    const plain = passwordStrength("bakeshop")
    const mixed = passwordStrength("Bakeshop1")
    const strong = passwordStrength("Bakeshop-2026!")

    expect(plain.score).toBeLessThan(mixed.score)
    expect(mixed.score).toBeLessThan(strong.score)
    expect(strong.score).toBe(4)
  })

  it("never exceeds the top of the scale", () => {
    expect(passwordStrength("Aling-Nena-Bakeshop-2026!!").score).toBe(4)
  })
})

describe("RegisterForm", () => {
  it("renders the sign-up fields with the right autofill hints", () => {
    render(<RegisterForm />)

    expect(screen.getByLabelText("Full name")).toHaveAttribute("autocomplete", "name")
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email")
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "new-password"
    )
    expect(screen.getByLabelText(/Business name/)).toHaveAttribute(
      "autocomplete",
      "organization"
    )
  })

  it("shows a strength hint once a password is typed", async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(screen.getByLabelText("Password"), "abc")
    expect(screen.getByText(/Too short/)).toBeInTheDocument()
  })

  it("swaps to a check-your-inbox state when confirmation is required", async () => {
    signUpWithPassword.mockResolvedValue({
      status: "check-email",
      email: "juan@raket.ph",
      message: "Confirm your email to finish setting up your account.",
    })

    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.click(screen.getByRole("button", { name: "Create account" }))

    expect(await screen.findByText("Check your inbox")).toBeInTheDocument()
    expect(screen.getByText("juan@raket.ph")).toBeInTheDocument()
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument()
  })
})

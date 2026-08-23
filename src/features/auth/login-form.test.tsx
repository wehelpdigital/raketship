import type { ComponentProps } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { signInWithPassword } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
}))

vi.mock("@/features/auth/actions", () => ({ signInWithPassword }))

vi.mock("next/link", () => ({
  default: function MockLink({ children, ...rest }: ComponentProps<"a">) {
    return <a {...rest}>{children}</a>
  },
}))

import { LoginForm } from "@/features/auth/login-form"

beforeEach(() => {
  vi.clearAllMocks()
  signInWithPassword.mockResolvedValue({ status: "idle" })
})

describe("LoginForm", () => {
  it("renders mobile-friendly email and password fields", () => {
    render(<LoginForm />)

    const email = screen.getByLabelText("Email")
    expect(email).toHaveAttribute("type", "email")
    expect(email).toHaveAttribute("inputmode", "email")
    expect(email).toHaveAttribute("autocomplete", "email")

    const password = screen.getByLabelText("Password")
    expect(password).toHaveAttribute("type", "password")
    expect(password).toHaveAttribute("autocomplete", "current-password")

    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument()
  })

  it("links to the register page", () => {
    render(<LoginForm />)

    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/register"
    )
  })

  it("carries the redirect target through a hidden field", () => {
    const { container } = render(<LoginForm nextPath="/raket/abc" />)

    const hidden = container.querySelector<HTMLInputElement>('input[name="next"]')
    expect(hidden?.value).toBe("/raket/abc")
  })

  it("shows a notice handed back from the OAuth callback", () => {
    render(<LoginForm notice="That sign-in link has expired." />)

    expect(screen.getByRole("alert")).toHaveTextContent(
      "That sign-in link has expired."
    )
  })

  it("toggles the password between hidden and visible", async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.click(screen.getByRole("button", { name: "Show password" }))
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text")

    await user.click(screen.getByRole("button", { name: "Hide password" }))
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password")
  })

  it("submits what was typed to the action", async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText("Email"), "juan@raket.ph")
    await user.type(screen.getByLabelText("Password"), "hunter22")
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(signInWithPassword).toHaveBeenCalled()
    const formData = signInWithPassword.mock.calls[0][1] as FormData
    expect(formData.get("email")).toBe("juan@raket.ph")
    expect(formData.get("password")).toBe("hunter22")
  })

  it("shows a field error underneath the offending input", async () => {
    signInWithPassword.mockResolvedValue({
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: { email: "That doesn't look like an email address." },
    })

    const user = userEvent.setup()
    render(<LoginForm />)

    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(
      await screen.findByText("That doesn't look like an email address.")
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true")
  })

  it("shows a general error as an alert", async () => {
    signInWithPassword.mockResolvedValue({
      status: "error",
      message: "That email and password don't match.",
    })

    const user = userEvent.setup()
    render(<LoginForm />)

    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That email and password don't match."
    )
  })
})

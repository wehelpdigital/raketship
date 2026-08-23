import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => {
  const authSignIn = vi.fn()
  const authSignUp = vi.fn()
  const authSignOut = vi.fn()
  const eq = vi.fn(async () => ({ error: null }))
  const update = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ update }))

  const client = {
    auth: {
      signInWithPassword: authSignIn,
      signUp: authSignUp,
      signOut: authSignOut,
    },
    from,
  }

  const state = {
    demoLoginEnabled: true,
    demoAdminEmail: "admin@raketship.ph",
    demoAdminPassword: "demo-pass-123",
    client: client as typeof client | null,
    user: { id: "user-1" } as { id: string } | null,
  }

  return { authSignIn, authSignUp, authSignOut, from, update, eq, client, state }
})

vi.mock("@/lib/env", () => ({
  env: {
    get demoLoginEnabled() {
      return h.state.demoLoginEnabled
    },
    siteUrl: "http://localhost:3000",
  },
  supabaseConfigured: true,
  serverEnv: () => ({
    supabaseUrl: "https://example.supabase.co",
    secretKey: "",
    demoAdminEmail: h.state.demoAdminEmail,
    demoAdminPassword: h.state.demoAdminPassword,
  }),
}))

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => h.state.client),
  getCurrentUser: vi.fn(async () => h.state.user),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  signInAsDemoAdmin,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  type AuthActionState,
} from "@/features/auth/actions"

const IDLE: AuthActionState = { status: "idle" }

function fd(entries: Record<string, string>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(entries)) form.append(key, value)
  return form
}

function asError(state: AuthActionState) {
  if (state.status !== "error") {
    throw new Error(`expected an error state, received "${state.status}"`)
  }
  return state
}

beforeEach(() => {
  vi.clearAllMocks()
  h.state.demoLoginEnabled = true
  h.state.demoAdminEmail = "admin@raketship.ph"
  h.state.demoAdminPassword = "demo-pass-123"
  h.state.client = h.client
  h.state.user = { id: "user-1" }
  h.eq.mockResolvedValue({ error: null })
})

describe("signInWithPassword", () => {
  it("rejects a malformed email before touching Supabase", async () => {
    const state = asError(
      await signInWithPassword(IDLE, fd({ email: "notanemail", password: "hunter22" }))
    )

    expect(state.fieldErrors?.email).toBeTruthy()
    expect(h.authSignIn).not.toHaveBeenCalled()
  })

  it("flags a missing password", async () => {
    const state = asError(
      await signInWithPassword(IDLE, fd({ email: "juan@raket.ph", password: "" }))
    )

    expect(state.fieldErrors?.password).toBe("Enter your password.")
    expect(h.authSignIn).not.toHaveBeenCalled()
  })

  it("trims the email before sending it on", async () => {
    h.authSignIn.mockResolvedValue({ error: null })

    await signInWithPassword(IDLE, fd({ email: "  juan@raket.ph ", password: "hunter22" }))

    expect(h.authSignIn).toHaveBeenCalledWith({
      email: "juan@raket.ph",
      password: "hunter22",
    })
  })

  it("rewrites 'Invalid login credentials'", async () => {
    h.authSignIn.mockResolvedValue({ error: { message: "Invalid login credentials" } })

    const state = asError(
      await signInWithPassword(IDLE, fd({ email: "juan@raket.ph", password: "hunter22" }))
    )

    expect(state.message).toBe("That email and password don't match.")
    expect(state.fieldErrors).toBeUndefined()
  })

  it("rewrites 'Email not confirmed'", async () => {
    h.authSignIn.mockResolvedValue({ error: { message: "Email not confirmed" } })

    const state = asError(
      await signInWithPassword(IDLE, fd({ email: "juan@raket.ph", password: "hunter22" }))
    )

    expect(state.message).toBe("Check your inbox to confirm your email first.")
  })

  it("rewrites a rate-limit response", async () => {
    h.authSignIn.mockResolvedValue({
      error: { message: "Request rate limit reached", status: 429 },
    })

    const state = asError(
      await signInWithPassword(IDLE, fd({ email: "juan@raket.ph", password: "hunter22" }))
    )

    expect(state.message).toBe("Too many tries. Give it a minute, then try again.")
  })

  it("keeps an unrecognised message rather than swallowing it", async () => {
    h.authSignIn.mockResolvedValue({ error: { message: "Database is on fire" } })

    const state = asError(
      await signInWithPassword(IDLE, fd({ email: "juan@raket.ph", password: "hunter22" }))
    )

    expect(state.message).toBe("Database is on fire")
  })

  it("revalidates and redirects to the requested path on success", async () => {
    h.authSignIn.mockResolvedValue({ error: null })

    await signInWithPassword(
      IDLE,
      fd({ email: "juan@raket.ph", password: "hunter22", next: "/raket/abc" })
    )

    expect(revalidatePath).toHaveBeenCalledWith("/", "layout")
    expect(redirect).toHaveBeenCalledWith("/raket/abc")
  })

  it("refuses an off-site redirect target", async () => {
    h.authSignIn.mockResolvedValue({ error: null })

    await signInWithPassword(
      IDLE,
      fd({ email: "juan@raket.ph", password: "hunter22", next: "//evil.example" })
    )

    expect(redirect).toHaveBeenCalledWith("/dashboard")
  })

  it("explains the missing publishable key when Supabase is unconfigured", async () => {
    h.state.client = null

    const state = asError(
      await signInWithPassword(IDLE, fd({ email: "juan@raket.ph", password: "hunter22" }))
    )

    expect(state.message).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    expect(h.authSignIn).not.toHaveBeenCalled()
  })
})

describe("signUpWithPassword", () => {
  const valid = {
    fullName: "Juan dela Cruz",
    email: "juan@raket.ph",
    password: "hunter22-ok",
  }

  it("requires a name and an 8-character password", async () => {
    const state = asError(
      await signUpWithPassword(IDLE, fd({ fullName: "J", email: "juan@raket.ph", password: "short" }))
    )

    expect(state.fieldErrors?.fullName).toBeTruthy()
    expect(state.fieldErrors?.password).toBe("Use at least 8 characters.")
    expect(h.authSignUp).not.toHaveBeenCalled()
  })

  it("drops an empty business name instead of storing a blank string", async () => {
    h.authSignUp.mockResolvedValue({ data: { session: { id: "s" } }, error: null })

    await signUpWithPassword(IDLE, fd({ ...valid, businessName: "   " }))

    expect(h.authSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: { full_name: "Juan dela Cruz", business_name: null },
        }),
      })
    )
    expect(h.from).not.toHaveBeenCalled()
  })

  it("returns a check-email state when the project confirms by email", async () => {
    h.authSignUp.mockResolvedValue({ data: { session: null, user: { id: "u" } }, error: null })

    const state = await signUpWithPassword(IDLE, fd(valid))

    expect(state.status).toBe("check-email")
    if (state.status === "check-email") {
      expect(state.email).toBe("juan@raket.ph")
    }
    expect(redirect).not.toHaveBeenCalled()
  })

  it("saves the business name against the signed-in user when a session comes back", async () => {
    h.authSignUp.mockResolvedValue({ data: { session: { id: "s" } }, error: null })

    await signUpWithPassword(IDLE, fd({ ...valid, businessName: "Aling Nena Bakeshop" }))

    expect(h.from).toHaveBeenCalledWith("profiles")
    expect(h.update).toHaveBeenCalledWith({ business_name: "Aling Nena Bakeshop" })
    expect(h.eq).toHaveBeenCalledWith("id", "user-1")
    expect(redirect).toHaveBeenCalledWith("/dashboard")
  })

  it("points a taken email at the email field", async () => {
    h.authSignUp.mockResolvedValue({
      data: { session: null },
      error: { message: "User already registered" },
    })

    const state = asError(await signUpWithPassword(IDLE, fd(valid)))

    expect(state.message).toBe("That email already has an account. Sign in instead.")
    expect(state.fieldErrors?.email).toBe(state.message)
  })
})

describe("signOut", () => {
  it("clears the session and sends the user to /login", async () => {
    h.authSignOut.mockResolvedValue({ error: null })

    await signOut()

    expect(h.authSignOut).toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout")
    expect(redirect).toHaveBeenCalledWith("/login")
  })

  it("still redirects when Supabase is unconfigured", async () => {
    h.state.client = null

    await signOut()

    expect(redirect).toHaveBeenCalledWith("/login")
  })
})

describe("signInAsDemoAdmin", () => {
  it("stays put when the demo login is switched off", async () => {
    h.state.demoLoginEnabled = false

    const state = asError(await signInAsDemoAdmin(IDLE, fd({})))

    expect(state.message).toContain("NEXT_PUBLIC_ENABLE_DEMO_LOGIN")
    expect(h.authSignIn).not.toHaveBeenCalled()
  })

  it("asks for the seed script when no password is configured", async () => {
    h.state.demoAdminPassword = ""

    const state = asError(await signInAsDemoAdmin(IDLE, fd({})))

    expect(state.message).toContain("db:seed-admin")
    expect(h.authSignIn).not.toHaveBeenCalled()
  })

  it("points at the seed script when the account does not exist yet", async () => {
    h.authSignIn.mockResolvedValue({ error: { message: "Invalid login credentials" } })

    const state = asError(await signInAsDemoAdmin(IDLE, fd({})))

    expect(state.message).toContain("db:seed-admin")
  })

  it("signs in with the configured credentials and redirects", async () => {
    h.authSignIn.mockResolvedValue({ error: null })

    await signInAsDemoAdmin(IDLE, fd({ next: "/dashboard" }))

    expect(h.authSignIn).toHaveBeenCalledWith({
      email: "admin@raketship.ph",
      password: "demo-pass-123",
    })
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout")
    expect(redirect).toHaveBeenCalledWith("/dashboard")
  })
})

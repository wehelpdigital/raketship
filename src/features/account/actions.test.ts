import { beforeEach, describe, expect, it, vi } from "vitest"

import { updateProfile } from "./actions"

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  getCurrentUser: mocks.getCurrentUser,
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}))

function stubClient() {
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ update }))
  mocks.getSupabaseServerClient.mockResolvedValue({ from })
  return { from, update, eq }
}

function formOf(fields: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

const IDLE = { status: "idle" } as const

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getCurrentUser.mockResolvedValue({ id: "user-1" })
})

describe("updateProfile", () => {
  it("refuses to write when nobody is signed in", async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const result = await updateProfile(
      IDLE,
      formOf({ fullName: "Juan dela Cruz", businessName: "Nena's" })
    )

    expect(result.status).toBe("error")
    expect(result.message).toMatch(/sign in/i)
    expect(mocks.getSupabaseServerClient).not.toHaveBeenCalled()
  })

  it("rejects a name that is too short", async () => {
    const { update } = stubClient()

    const result = await updateProfile(
      IDLE,
      formOf({ fullName: "J", businessName: "" })
    )

    expect(result.status).toBe("error")
    expect(result.fieldErrors?.fullName).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
  })

  it("rejects a business name over 80 characters", async () => {
    const { update } = stubClient()

    const result = await updateProfile(
      IDLE,
      formOf({ fullName: "Juan dela Cruz", businessName: "x".repeat(81) })
    )

    expect(result.status).toBe("error")
    expect(result.fieldErrors?.businessName).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
  })

  it("keeps what the user typed so the form can re-render it", async () => {
    stubClient()

    const result = await updateProfile(
      IDLE,
      formOf({ fullName: "", businessName: "Nena's Bakeshop" })
    )

    expect(result.values).toEqual({
      fullName: "",
      businessName: "Nena's Bakeshop",
    })
  })

  it("saves trimmed values against the session's own row", async () => {
    const { from, update, eq } = stubClient()

    const result = await updateProfile(
      IDLE,
      formOf({
        fullName: "  Juan dela Cruz  ",
        businessName: "  Nena's Bakeshop  ",
      })
    )

    expect(from).toHaveBeenCalledWith("profiles")
    expect(update).toHaveBeenCalledWith({
      full_name: "Juan dela Cruz",
      business_name: "Nena's Bakeshop",
    })
    expect(eq).toHaveBeenCalledWith("id", "user-1")
    expect(result.status).toBe("success")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/account")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard")
  })

  it("stores an empty business name as null", async () => {
    const { update } = stubClient()

    await updateProfile(IDLE, formOf({ fullName: "Juan dela Cruz", businessName: "   " }))

    expect(update).toHaveBeenCalledWith({
      full_name: "Juan dela Cruz",
      business_name: null,
    })
  })

  it("explains itself when Supabase is not connected", async () => {
    mocks.getSupabaseServerClient.mockResolvedValue(null)

    const result = await updateProfile(
      IDLE,
      formOf({ fullName: "Juan dela Cruz", businessName: "" })
    )

    expect(result.status).toBe("error")
    expect(result.message).toMatch(/not connected/i)
  })

  it("surfaces a database error without throwing", async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: "boom" } })
    const update = vi.fn(() => ({ eq }))
    mocks.getSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => ({ update })),
    })

    const result = await updateProfile(
      IDLE,
      formOf({ fullName: "Juan dela Cruz", businessName: "" })
    )

    expect(result.status).toBe("error")
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
})

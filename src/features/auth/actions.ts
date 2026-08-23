"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { demoLoginVisible, safeNextPath } from "@/features/auth/guards"
import { env, serverEnv, supabaseConfigured } from "@/lib/env"
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server"

export type AuthActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "check-email"; message: string; email: string }

const SETUP_MESSAGE =
  "Supabase isn't connected yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart the dev server."

const signInSchema = z.object({
  email: z.email("That doesn't look like an email address."),
  password: z.string().min(1, "Enter your password."),
})

const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Tell us what to call you — at least 2 characters."),
  email: z.email("That doesn't look like an email address."),
  password: z.string().min(8, "Use at least 8 characters."),
  businessName: z
    .string()
    .trim()
    .max(80, "Keep the business name under 80 characters.")
    .optional(),
})

type IssueLike = {
  readonly path: readonly PropertyKey[]
  readonly message: string
}

function firstFieldErrors(issues: readonly IssueLike[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path[0]
    if (typeof key === "string" && !(key in out)) out[key] = issue.message
  }
  return out
}

type SupabaseAuthError = { message?: string; status?: number }

/** Supabase answers in raw strings; the person reading this deserves plain words. */
function mapAuthError(error: SupabaseAuthError): string {
  const raw = (error.message ?? "").trim()
  const m = raw.toLowerCase()

  if (m.includes("invalid login credentials")) {
    return "That email and password don't match."
  }
  if (m.includes("email not confirmed")) {
    return "Check your inbox to confirm your email first."
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "That email already has an account. Sign in instead."
  }
  if (m.includes("password should be at least") || m.includes("weak password")) {
    return "That password is too easy to guess. Use at least 8 characters."
  }
  if (m.includes("provider is not enabled") || m.includes("unsupported provider")) {
    return "That sign-in option isn't switched on for this project yet."
  }
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) {
    return "New sign-ups are switched off on this project right now."
  }
  if (m.includes("email rate limit") || m.includes("over_email_send_rate_limit")) {
    return "Too many emails sent from this project. Wait a few minutes, then try again."
  }
  if (
    m.includes("for security purposes") ||
    m.includes("too many requests") ||
    error.status === 429
  ) {
    return "Too many tries. Give it a minute, then try again."
  }
  if (m.includes("invalid api key") || m.includes("no api key")) {
    return "Supabase rejected the API key. Double-check NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local."
  }
  if (m.includes("fetch failed") || m.includes("failed to fetch") || m.includes("network")) {
    return "Can't reach Supabase right now. Check your connection and try again."
  }

  return raw.length > 0 ? raw : "Something went wrong. Please try again."
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

export async function signInWithPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  if (!supabaseConfigured) {
    return { status: "error", message: SETUP_MESSAGE }
  }

  const parsed = signInSchema.safeParse({
    email: text(formData, "email").trim(),
    password: text(formData, "password"),
  })

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error.issues),
    }
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return { status: "error", message: SETUP_MESSAGE }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { status: "error", message: mapAuthError(error) }
  }

  revalidatePath("/", "layout")
  redirect(safeNextPath(formData.get("next")))
}

export async function signUpWithPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  if (!supabaseConfigured) {
    return { status: "error", message: SETUP_MESSAGE }
  }

  const rawBusinessName = text(formData, "businessName").trim()
  const parsed = signUpSchema.safeParse({
    fullName: text(formData, "fullName"),
    email: text(formData, "email").trim(),
    password: text(formData, "password"),
    businessName: rawBusinessName.length > 0 ? rawBusinessName : undefined,
  })

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error.issues),
    }
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return { status: "error", message: SETUP_MESSAGE }
  }

  const next = safeNextPath(formData.get("next"))
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        business_name: parsed.data.businessName ?? null,
      },
      emailRedirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  })

  if (error) {
    const message = mapAuthError(error)
    const emailIsTaken = message.startsWith("That email already has an account")
    return {
      status: "error",
      message,
      ...(emailIsTaken ? { fieldErrors: { email: message } } : {}),
    }
  }

  // No session means the project wants an inbox round-trip before first sign-in.
  if (!data.session) {
    return {
      status: "check-email",
      email: parsed.data.email,
      message: "Confirm your email to finish setting up your account.",
    }
  }

  if (parsed.data.businessName) {
    const user = await getCurrentUser()
    if (user) {
      await supabase
        .from("profiles")
        .update({ business_name: parsed.data.businessName })
        .eq("id", user.id)
    }
  }

  revalidatePath("/", "layout")
  redirect(next)
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabaseServerClient()
  if (supabase) {
    await supabase.auth.signOut()
  }

  revalidatePath("/", "layout")
  redirect("/login")
}

export async function signInAsDemoAdmin(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  if (!demoLoginVisible()) {
    return {
      status: "error",
      message:
        "The demo login is switched off. Set NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true in .env.local to bring it back.",
    }
  }

  if (!supabaseConfigured) {
    return { status: "error", message: SETUP_MESSAGE }
  }

  const { demoAdminEmail, demoAdminPassword } = serverEnv()
  if (!demoAdminEmail || !demoAdminPassword) {
    return {
      status: "error",
      message:
        "Set DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD in .env.local, then run npm run db:seed-admin.",
    }
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return { status: "error", message: SETUP_MESSAGE }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: demoAdminEmail,
    password: demoAdminPassword,
  })

  if (error) {
    const m = (error.message ?? "").toLowerCase()
    if (m.includes("invalid login credentials") || m.includes("email not confirmed")) {
      return {
        status: "error",
        message:
          "The demo admin account doesn't exist on this project yet. Run npm run db:seed-admin, then try again.",
      }
    }
    return { status: "error", message: mapAuthError(error) }
  }

  revalidatePath("/", "layout")
  redirect(safeNextPath(formData.get("next")))
}

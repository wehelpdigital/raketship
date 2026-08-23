"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server"
import type { ProfileRow } from "@/lib/supabase/types"

export interface ProfileFormState {
  status: "idle" | "success" | "error"
  message?: string
  fieldErrors?: {
    fullName?: string
    businessName?: string
  }
  values?: {
    fullName: string
    businessName: string
  }
}

const ProfileInput = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Pakilagay ang pangalan mo — at least 2 characters.")
    .max(80, "Keep your name under 80 characters."),
  businessName: z
    .string()
    .trim()
    .max(80, "Keep your business name under 80 characters."),
})

export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  // Never trust an id from the form — the session decides whose row this is.
  const user = await getCurrentUser()
  if (!user) {
    return {
      status: "error",
      message: "Your session expired. Please sign in again.",
    }
  }

  const values = {
    fullName: String(formData.get("fullName") ?? ""),
    businessName: String(formData.get("businessName") ?? ""),
  }

  const parsed = ProfileInput.safeParse(values)
  if (!parsed.success) {
    const fieldErrors: NonNullable<ProfileFormState["fieldErrors"]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (key === "fullName" && !fieldErrors.fullName) {
        fieldErrors.fullName = issue.message
      }
      if (key === "businessName" && !fieldErrors.businessName) {
        fieldErrors.businessName = issue.message
      }
    }
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors,
      values,
    }
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return {
      status: "error",
      message:
        "Supabase is not connected yet, so there is nowhere to save this.",
      values: parsed.data,
    }
  }

  const patch = {
    full_name: parsed.data.fullName,
    business_name: parsed.data.businessName || null,
  } satisfies Partial<ProfileRow>

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)

  if (error) {
    return {
      status: "error",
      message: "We could not save that. Pakisubukan ulit in a moment.",
      values: parsed.data,
    }
  }

  revalidatePath("/account")
  revalidatePath("/dashboard")

  return {
    status: "success",
    message: "Saved. Salamat!",
    values: parsed.data,
  }
}

"use server"

/**
 * Every write the Your Business module makes.
 *
 * Same two rules as the Booking module: identity is re-derived from the session
 * cookie on every call, and every statement is scoped by that user_id. Nothing
 * arriving from the browser says who may write.
 */

import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  normalisePhMobile,
  tidyHandle,
  tidyUrl,
} from "@/lib/business/contact"
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MEDIA_BUCKET,
} from "@/lib/business/media"
import { isPaletteKey } from "@/lib/theme/palettes"
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server"
import type { BusinessProfileRow, Database } from "@/lib/supabase/types"

type Tables = Database["public"]["Tables"]
type Patch<T extends keyof Tables> = Tables[T]["Update"]
type Insert<T extends keyof Tables> = Tables[T]["Insert"]

export interface BusinessActionResult {
  ok: boolean
  message?: string
  fieldErrors?: Record<string, string>
}

const NO_DATABASE =
  "RaketShip is not connected to its database yet, so nothing was saved."
const SIGN_IN_AGAIN = "We could not tell who you are. Please sign in again."
const TRY_AGAIN = "Something did not go through. Pakisubukan ulit."

function fail(message: string, fieldErrors?: Record<string, string>) {
  return fieldErrors ? { ok: false, message, fieldErrors } : { ok: false, message }
}

function refresh(): void {
  revalidatePath("/modules/business")
  revalidatePath("/dashboard")
  revalidatePath("/account")
  revalidatePath("/book/[slug]", "page")
  // The shell itself is repainted by the palette, so every page is stale.
  revalidatePath("/", "layout")
}

type Db = NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>

async function requireSession(): Promise<
  { db: Db; userId: string } | { error: BusinessActionResult }
> {
  const user = await getCurrentUser()
  if (!user) return { error: fail(SIGN_IN_AGAIN) }
  const db = await getSupabaseServerClient()
  if (!db) return { error: fail(NO_DATABASE) }
  return { db, userId: user.id }
}

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

const CHAT_APPS = ["viber", "whatsapp", "telegram"] as const
const VISIBILITY = ["full", "area", "hidden"] as const


const text = (max: number) => z.string().trim().max(max)

const profileSchema = z.object({
  businessName: z
    .string()
    .trim()
    .max(80, "Keep the business name under 80 characters."),
  tagline: text(60).describe("tagline"),
  description: text(600),
  businessType: text(40),
  themePreset: z.string().trim().max(40),
  mobileNumber: text(40),
  chatApps: z.array(z.enum(CHAT_APPS)).max(8),
  facebookUrl: text(300),
  instagramHandle: text(120),
  websiteUrl: text(300),
  gcashNumber: text(40),
  mayaNumber: text(40),
  paymentName: text(80),
  paymentNote: text(300),
  streetAddress: text(120),
  barangay: text(80),
  city: text(80),
  province: text(80),
  landmark: text(120),
  addressVisibility: z.enum(VISIBILITY),
  hoursNote: text(120),
})

export type SaveBusinessInput = z.input<typeof profileSchema>

const orNull = (value: string) => (value.length > 0 ? value : null)

// -----------------------------------------------------------------------------
// Save
// -----------------------------------------------------------------------------

/**
 * Writes the whole form in one go.
 *
 * The business NAME goes to public.profiles, where it already lives and where
 * the dashboard and the account page read it. Everything else goes to
 * business_profiles. Two tables, one save, so the two can never disagree.
 */
export async function saveBusinessProfile(
  input: SaveBusinessInput
): Promise<BusinessActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return fail(issue?.message ?? "Pakicheck po ang mga naitype.")
  }
  const v = parsed.data

  const fieldErrors: Record<string, string> = {}

  // Numbers are normalised rather than merely accepted, so 0917..., +63917...
  // and 63917... never end up looking like three different shops.
  let mobile: string | null = null
  if (v.mobileNumber) {
    mobile = normalisePhMobile(v.mobileNumber)
    if (!mobile) fieldErrors.mobileNumber = "That mobile number does not look right."
  }
  let gcash: string | null = null
  if (v.gcashNumber) {
    gcash = normalisePhMobile(v.gcashNumber)
    if (!gcash) fieldErrors.gcashNumber = "A GCash number is an 09xx mobile number."
  }
  let maya: string | null = null
  if (v.mayaNumber) {
    maya = normalisePhMobile(v.mayaNumber)
    if (!maya) fieldErrors.mayaNumber = "A Maya number is an 09xx mobile number."
  }

  let facebook: string | null = null
  if (v.facebookUrl) {
    facebook = tidyUrl(v.facebookUrl)
    if (!facebook) fieldErrors.facebookUrl = "Paste the link to your Facebook Page."
  }
  let website: string | null = null
  if (v.websiteUrl) {
    website = tidyUrl(v.websiteUrl)
    if (!website) fieldErrors.websiteUrl = "That link does not look right."
  }
  let instagram: string | null = null
  if (v.instagramHandle) {
    instagram = tidyHandle(v.instagramHandle)
    if (!instagram) fieldErrors.instagramHandle = "Just the handle, like aling.nena."
  }

  if (Object.keys(fieldErrors).length > 0) {
    return fail("Kulang pa po ang ilang detalye. Please check the marked boxes.", fieldErrors)
  }

  // An unknown palette key would repaint nothing, so it is refused here rather
  // than silently stored and quietly ignored at render time.
  const preset = isPaletteKey(v.themePreset) ? v.themePreset : null
  if (!preset) return fail("Pumili po ng kulay mula sa listahan.")

  const patch: Insert<"business_profiles"> = {
    user_id: userId,
    business_name: orNull(v.businessName),
    tagline: orNull(v.tagline),
    description: orNull(v.description),
    business_type: orNull(v.businessType),
    theme_preset: preset,
    mobile_number: mobile,
    chat_apps: v.chatApps,
    facebook_url: facebook,
    instagram_handle: instagram,
    website_url: website,
    gcash_number: gcash,
    maya_number: maya,
    payment_name: orNull(v.paymentName),
    payment_note: orNull(v.paymentNote),
    street_address: orNull(v.streetAddress),
    barangay: orNull(v.barangay),
    city: orNull(v.city),
    province: orNull(v.province),
    landmark: orNull(v.landmark),
    address_visibility: v.addressVisibility,
    hours_note: orNull(v.hoursNote),
  }

  const { error } = await db
    .from("business_profiles")
    .upsert(patch, { onConflict: "user_id" })

  if (error) return fail(TRY_AGAIN)

  // The same name, written a second time to the row the dashboard and the
  // account page read. Two destinations, one write, so they cannot disagree.
  const namePatch: Patch<"profiles"> = { business_name: orNull(v.businessName) }
  const { error: nameError } = await db
    .from("profiles")
    .update(namePatch)
    .eq("id", userId)

  if (nameError) return fail(TRY_AGAIN)

  refresh()
  return { ok: true, message: "Saved. Salamat po!" }
}

/**
 * Just the colour, saved on the tap.
 *
 * Split from the full save because picking a swatch should repaint immediately
 * — making someone scroll to a Save button to see their own colour is the kind
 * of thing that makes a feature feel broken.
 */
export async function setThemePreset(preset: string): Promise<BusinessActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  if (typeof preset !== "string" || !isPaletteKey(preset)) {
    return fail("Pumili po ng kulay mula sa listahan.")
  }

  const row: Insert<"business_profiles"> = { user_id: userId, theme_preset: preset }
  const { error } = await db
    .from("business_profiles")
    .upsert(row, { onConflict: "user_id" })

  if (error) return fail(TRY_AGAIN)

  refresh()
  return { ok: true, message: "Kulay saved." }
}

// -----------------------------------------------------------------------------
// Logo and cover
// -----------------------------------------------------------------------------

/**
 * Stores one image and points the row at it.
 *
 * The file arrives as FormData because that is the only way bytes cross a
 * server-action boundary without being base64'd through JSON.
 *
 * Both the type and the size are re-checked here even though the browser
 * checked them and the bucket will check them again: the browser's check is a
 * courtesy to the user, not a control, and a server action is a public endpoint.
 */
export async function uploadBusinessImage(
  formData: FormData
): Promise<BusinessActionResult & { path?: string }> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const kind = formData.get("kind")
  if (kind !== "logo" && kind !== "cover") {
    return fail("We could not tell which image that was.")
  }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return fail("Pumili po ng larawan.")
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return fail("Ang laki ng file — 5MB lang po ang kaya.")
  }
  if (!IMAGE_TYPES.includes(file.type)) {
    return fail("PNG, JPG, WEBP o AVIF lang po.")
  }

  // Filed under the owner's uuid: the storage policy checks exactly that first
  // path segment, so a name built anywhere else would be rejected by the bucket.
  const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png"
  // The timestamp busts the CDN cache. Overwriting one stable name would leave
  // the old picture showing on a public page for as long as it stayed cached.
  const path = `${userId}/${kind}-${Date.now()}.${extension}`

  const { error: uploadError } = await db.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true })

  if (uploadError) return fail("Hindi na-upload ang larawan. Pakisubukan ulit.")

  const previous = await currentPath(db, userId, kind)

  const patch: Insert<"business_profiles"> =
    kind === "logo"
      ? { user_id: userId, logo_path: path }
      : { user_id: userId, cover_path: path }

  const { error } = await db
    .from("business_profiles")
    .upsert(patch, { onConflict: "user_id" })

  if (error) {
    // The row is the source of truth; an orphaned object nobody points at is
    // worse than no object, so the upload is undone rather than left behind.
    await db.storage.from(MEDIA_BUCKET).remove([path])
    return fail(TRY_AGAIN)
  }

  if (previous && previous !== path) {
    await db.storage.from(MEDIA_BUCKET).remove([previous])
  }

  refresh()
  return { ok: true, message: kind === "logo" ? "Logo saved." : "Cover saved.", path }
}

/** Clears one image and removes the file behind it. */
export async function removeBusinessImage(
  kind: "logo" | "cover"
): Promise<BusinessActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  if (kind !== "logo" && kind !== "cover") {
    return fail("We could not tell which image that was.")
  }

  const previous = await currentPath(db, userId, kind)

  const patch: Patch<"business_profiles"> =
    kind === "logo" ? { logo_path: null } : { cover_path: null }

  const { error } = await db
    .from("business_profiles")
    .update(patch)
    .eq("user_id", userId)

  if (error) return fail(TRY_AGAIN)

  if (previous) await db.storage.from(MEDIA_BUCKET).remove([previous])

  refresh()
  return { ok: true, message: "Tinanggal na." }
}

/** What the row points at now, so the replaced file can be cleaned up. */
async function currentPath(
  db: Db,
  userId: string,
  kind: "logo" | "cover"
): Promise<string | null> {
  const { data } = await db
    .from("business_profiles")
    .select("logo_path, cover_path")
    .eq("user_id", userId)
    .maybeSingle()

  const row = data as Pick<BusinessProfileRow, "logo_path" | "cover_path"> | null
  return (kind === "logo" ? row?.logo_path : row?.cover_path) ?? null
}

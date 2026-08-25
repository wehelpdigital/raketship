"use server"

/**
 * Every write the Booking module makes.
 *
 * Shared ground: the calendar list, the availability editor, the form builder
 * and the share panel all post through here. Two rules hold across the file —
 * identity is re-derived from the session cookie on every call, and every
 * statement is filtered by that user_id as well as by the id the client sent.
 * An id arriving from the browser says *what* to touch, never who may touch it.
 */

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getFieldType } from "@/lib/booking/fields"
import { WEEKDAY_LABELS } from "@/lib/booking/slots"
import { slugify, uniqueSlug, validateSlug } from "@/lib/booking/slug"
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server"
import type { BookingCalendarRow, Database } from "@/lib/supabase/types"

// -----------------------------------------------------------------------------
// Shapes
// -----------------------------------------------------------------------------

/** Uniform reply for every action in this file. */
export interface BookingActionResult {
  ok: boolean
  message?: string
  /** The row that was created or touched, when there is a useful one. */
  id?: string
}

export interface UpdateCalendarInput {
  calendarId: string
  name?: string
  description?: string | null
  durationMinutes?: number
  bufferMinutes?: number
  noticeHours?: number
  cancelNoticeHours?: number
  horizonDays?: number
  timezone?: string
  country?: string
  sendConfirmationEmail?: boolean
  sendReminderEmail?: boolean
  reminder24h?: boolean
  reminder8h?: boolean
  reminder15m?: boolean
}

/** One weekly window. Minutes count from midnight in the calendar's timezone. */
export interface AvailabilityRule {
  /** 0 = Sunday, matching JS getDay(). */
  weekday: number
  startMinute: number
  endMinute: number
}

export interface SetAvailabilityInput {
  calendarId: string
  rules: AvailabilityRule[]
}

export interface SaveFieldInput {
  calendarId: string
  /** Omit to add a new question; pass it to edit one in place. */
  fieldId?: string
  label: string
  type: string
  help?: string
  placeholder?: string
  required: boolean
  options: string[]
}

type Db = NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>

type Tables = Database["public"]["Tables"]
type Insert<T extends keyof Tables> = Tables[T]["Insert"]
type Patch<T extends keyof Tables> = Tables[T]["Update"]

// -----------------------------------------------------------------------------
// Plain speech for the things that go wrong
// -----------------------------------------------------------------------------

const NO_DATABASE =
  "RaketShip is not connected to its database yet, so nothing was saved."
const SIGN_IN_AGAIN = "We could not tell who you are. Please sign in again."
const CALENDAR_NOT_FOUND = "We could not find that calendar."
const SLUG_TAKEN = "That link is taken. Try another one."
const TRY_AGAIN = "Something did not go through. Please try again."

function fail(message: string): BookingActionResult {
  return { ok: false, message }
}

function done(message: string, id?: string): BookingActionResult {
  return id ? { ok: true, message, id } : { ok: true, message }
}

/** Structurally a ZodError, without pulling the class into the type surface. */
function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Please check what you typed."
}

/**
 * Postgres unique-violation. Every caller maps it to plain words, so a raw
 * "duplicate key value violates constraint ..." never reaches a suki-facing UI.
 */
function isUniqueViolation(error: { code?: string | null } | null): boolean {
  return error?.code === "23505"
}

// -----------------------------------------------------------------------------
// Session + ownership
// -----------------------------------------------------------------------------

async function requireSession(): Promise<
  { db: Db; userId: string } | { error: BookingActionResult }
> {
  const user = await getCurrentUser()
  if (!user) return { error: fail(SIGN_IN_AGAIN) }
  const db = await getSupabaseServerClient()
  if (!db) return { error: fail(NO_DATABASE) }
  return { db, userId: user.id }
}

/**
 * The gate every calendar-scoped write passes through. Filtering on user_id
 * here means a calendar id lifted from someone else's public link simply reads
 * back as "not found".
 */
async function loadCalendar(
  db: Db,
  userId: string,
  calendarId: string | undefined
): Promise<BookingCalendarRow | null> {
  if (typeof calendarId !== "string" || calendarId.length === 0) return null
  const { data } = await db
    .from("booking_calendars")
    .select("*")
    .eq("id", calendarId)
    .eq("user_id", userId)
    .maybeSingle()
  return (data as BookingCalendarRow | null) ?? null
}

/**
 * Booking shows up on four surfaces: the module index, the editor, the owner's
 * dashboard and the public page. The dynamic routes are revalidated by their
 * template, which covers every calendar and every slug in one call.
 */
function refresh(): void {
  revalidatePath("/modules/booking")
  revalidatePath("/modules/booking/[calendarId]", "page")
  revalidatePath("/book/[slug]", "page")
  revalidatePath("/dashboard")
}

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

const nameSchema = z
  .string()
  .min(2, "Give this calendar a name, at least 2 characters.")
  .max(80, "Keep the name under 80 characters.")

const descriptionSchema = z
  .string()
  .max(500, "Keep the description under 500 characters.")

const durationSchema = z
  .number()
  .int("Minutes need to be a whole number.")
  .min(5, "A slot needs to be at least 5 minutes long.")
  .max(480, "A slot can be at most 8 hours long.")

const bufferSchema = z
  .number()
  .int("Minutes need to be a whole number.")
  .min(0, "The gap between bookings cannot be negative.")
  .max(240, "Keep the gap between bookings under 4 hours.")

const noticeSchema = z
  .number()
  .int("Hours need to be a whole number.")
  .min(0, "Notice cannot be negative.")
  .max(720, "Keep the notice under 30 days.")

/**
 * Mirrors the booking_calendars_horizon_range check constraint. Kept in step
 * with it deliberately: the database is the real guard, this is only so the
 * owner gets a sentence instead of a Postgres error code.
 */
const horizonSchema = z
  .number()
  .int("Days need to be a whole number.")
  .min(1, "A calendar has to accept bookings for at least a day.")
  .max(365, "A year ahead is the furthest a calendar can go.")

/**
 * Mirrors the booking_calendars_cancel_notice check constraint. The database is
 * the real guard; this is so the owner gets a sentence rather than an error code.
 */
const cancelNoticeSchema = z
  .number()
  .int("Hours need to be a whole number.")
  .min(0, "That cannot be negative.")
  .max(720, "Keep it under 30 days.")

const countrySchema = z
  .string()
  .regex(/^[A-Za-z]{2}$/, "Pick a country from the list.")

const calendarSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  durationMinutes: durationSchema,
  bufferMinutes: bufferSchema,
  noticeHours: noticeSchema,
  cancelNoticeHours: cancelNoticeSchema,
  horizonDays: horizonSchema,
  timezone: z.string().min(1, "Pick a timezone.").max(64, "Pick a timezone."),
  country: countrySchema,
  slug: z.string().max(64, "Keep the link short."),
})

const ruleSchema = z.object({
  weekday: z
    .number()
    .int("That is not a day of the week.")
    .min(0, "That is not a day of the week.")
    .max(6, "That is not a day of the week."),
  startMinute: z
    .number()
    .int("That is not a time of day.")
    .min(0, "That is not a time of day.")
    .max(1440, "That is not a time of day."),
  endMinute: z
    .number()
    .int("That is not a time of day.")
    .min(0, "That is not a time of day.")
    .max(1440, "That is not a time of day."),
})

const availabilitySchema = z.object({
  calendarId: z.string().min(1, CALENDAR_NOT_FOUND),
  rules: z
    .array(ruleSchema)
    .max(60, "That is more time ranges than one week can hold."),
})

const blackoutSchema = z.object({
  calendarId: z.string().min(1, CALENDAR_NOT_FOUND),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date first."),
  reason: z.string().max(120, "Keep the reason under 120 characters."),
})

const fieldSchema = z.object({
  calendarId: z.string().min(1, CALENDAR_NOT_FOUND),
  fieldId: z.string().min(1).optional(),
  label: z
    .string()
    .min(1, "Every question needs a label.")
    .max(120, "Keep the question under 120 characters."),
  type: z.string().min(1, "Pick a question type."),
  help: z.string().max(200, "Keep the hint under 200 characters."),
  placeholder: z.string().max(120, "Keep the placeholder under 120 characters."),
  required: z.boolean(),
  options: z.array(z.string()).max(50, "That is a very long list of choices."),
})

/** Rejects anything Intl cannot resolve, so a junk zone never reaches storage. */
function isKnownTimezone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/** A calendar date that actually exists. 2026-02-31 does not. */
function isRealDate(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  )
}

function cleanOptions(options: readonly string[]): string[] {
  const seen = new Set<string>()
  const clean: string[] = []
  for (const raw of options) {
    const value = String(raw).trim().slice(0, 80)
    if (value.length === 0) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    clean.push(value)
    if (clean.length >= 25) break
  }
  return clean
}

function text(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function numberField(form: FormData, key: string, fallback: number): number {
  const raw = text(form, key)
  if (raw.length === 0) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback
}

// -----------------------------------------------------------------------------
// Slugs
// -----------------------------------------------------------------------------

/**
 * Slugs sit in one namespace shared by every account, so "is it free" cannot be
 * answered from the caller's own rows — hence the security-definer RPC. When
 * the RPC is unreachable the unique index gets the final word, rather than the
 * save being blocked on a check that could not run.
 */
async function slugIsFree(db: Db, slug: string): Promise<boolean> {
  const { data, error } = await db.rpc("booking_slug_available", {
    p_slug: slug,
  })
  if (error) return true
  return data !== false
}

/** A free slug close to what was asked for, without a long round-trip loop. */
async function pickSlug(
  db: Db,
  userId: string,
  desired: string
): Promise<string> {
  const { data } = await db
    .from("booking_calendars")
    .select("slug")
    .eq("user_id", userId)

  const taken = ((data as { slug: string }[] | null) ?? []).map((row) =>
    row.slug.toLowerCase()
  )

  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = uniqueSlug(desired, taken)
    if (await slugIsFree(db, candidate)) return candidate
    taken.push(candidate)
  }

  const seed = (slugify(desired) || "booking").slice(0, 40)
  return `${seed}-${Date.now().toString(36).slice(-4)}`
}

// =============================================================================
// Calendars
// =============================================================================

/**
 * Creates a calendar from the new-calendar dialog. The slug is derived from the
 * name so nobody has to think about links on the very first screen; the share
 * panel lets them change it later.
 */
export async function createCalendar(
  formData: FormData
): Promise<BookingActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const parsed = calendarSchema.safeParse({
    name: text(formData, "name"),
    description: text(formData, "description"),
    durationMinutes: numberField(formData, "durationMinutes", 30),
    bufferMinutes: numberField(formData, "bufferMinutes", 0),
    noticeHours: numberField(formData, "noticeHours", 2),
    cancelNoticeHours: numberField(formData, "cancelNoticeHours", 24),
    horizonDays: numberField(formData, "horizonDays", 14),
    timezone: text(formData, "timezone") || "Asia/Manila",
    country: text(formData, "country") || "PH",
    slug: text(formData, "slug"),
  })
  if (!parsed.success) return fail(firstIssue(parsed.error))
  const input = parsed.data

  if (!isKnownTimezone(input.timezone)) {
    return fail("We do not recognise that timezone. Pick one from the list.")
  }

  if (input.slug.length > 0) {
    const problem = validateSlug(input.slug)
    if (problem) return fail(problem)
  }

  const slug = await pickSlug(db, userId, input.slug || input.name)

  const payload: Insert<"booking_calendars"> = {
    user_id: userId,
    name: input.name,
    description: input.description.length > 0 ? input.description : null,
    slug,
    timezone: input.timezone,
    country: input.country.toUpperCase(),
    duration_minutes: input.durationMinutes,
    buffer_minutes: input.bufferMinutes,
    notice_hours: input.noticeHours,
    cancel_notice_hours: input.cancelNoticeHours,
    booking_horizon_days: input.horizonDays,
    is_published: false,
  }

  const { data, error } = await db
    .from("booking_calendars")
    .insert(payload)
    .select("id")
    .maybeSingle()

  if (error) return fail(isUniqueViolation(error) ? SLUG_TAKEN : TRY_AGAIN)

  refresh()
  return done(
    `"${input.name}" is ready. Set your days and hours next.`,
    (data as { id: string } | null)?.id
  )
}

/** Saves the Details tab. Only the keys actually passed get written. */
export async function updateCalendar(
  input: UpdateCalendarInput
): Promise<BookingActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const calendar = await loadCalendar(db, userId, input?.calendarId)
  if (!calendar) return fail(CALENDAR_NOT_FOUND)

  const patch: Patch<"booking_calendars"> = {}

  if (input.name !== undefined) {
    const parsed = nameSchema.safeParse(input.name.trim())
    if (!parsed.success) return fail(firstIssue(parsed.error))
    patch.name = parsed.data
  }

  if (input.description !== undefined) {
    const parsed = descriptionSchema.safeParse((input.description ?? "").trim())
    if (!parsed.success) return fail(firstIssue(parsed.error))
    patch.description = parsed.data.length > 0 ? parsed.data : null
  }

  if (input.durationMinutes !== undefined) {
    const parsed = durationSchema.safeParse(input.durationMinutes)
    if (!parsed.success) return fail(firstIssue(parsed.error))
    patch.duration_minutes = parsed.data
  }

  if (input.bufferMinutes !== undefined) {
    const parsed = bufferSchema.safeParse(input.bufferMinutes)
    if (!parsed.success) return fail(firstIssue(parsed.error))
    patch.buffer_minutes = parsed.data
  }

  if (input.noticeHours !== undefined) {
    const parsed = noticeSchema.safeParse(input.noticeHours)
    if (!parsed.success) return fail(firstIssue(parsed.error))
    patch.notice_hours = parsed.data
  }

  if (input.cancelNoticeHours !== undefined) {
    const parsed = cancelNoticeSchema.safeParse(input.cancelNoticeHours)
    if (!parsed.success) return fail(firstIssue(parsed.error))
    patch.cancel_notice_hours = parsed.data
  }

  if (input.horizonDays !== undefined) {
    const parsed = horizonSchema.safeParse(input.horizonDays)
    if (!parsed.success) return fail(firstIssue(parsed.error))
    patch.booking_horizon_days = parsed.data
  }

  // Booleans, not zod: there is no way to be almost-a-boolean, and a
  // truthy string sneaking in as "true" is exactly what Boolean() would bless.
  const reminderSwitches = [
    ["reminder24h", "reminder_24h"],
    ["reminder8h", "reminder_8h"],
    ["reminder15m", "reminder_15m"],
  ] as const
  for (const [field, column] of reminderSwitches) {
    const value = input[field]
    if (value === undefined) continue
    if (typeof value !== "boolean") {
      return fail("That setting did not come through right. Pakisubukan ulit.")
    }
    patch[column] = value
  }

  if (input.sendConfirmationEmail !== undefined) {
    if (typeof input.sendConfirmationEmail !== "boolean") {
      return fail("That setting did not come through right. Pakisubukan ulit.")
    }
    patch.send_confirmation_email = input.sendConfirmationEmail
  }

  if (input.sendReminderEmail !== undefined) {
    if (typeof input.sendReminderEmail !== "boolean") {
      return fail("That setting did not come through right. Pakisubukan ulit.")
    }
    patch.send_reminder_email = input.sendReminderEmail
  }

  if (input.timezone !== undefined) {
    const zone = input.timezone.trim()
    if (!isKnownTimezone(zone)) {
      return fail("We do not recognise that timezone. Pick one from the list.")
    }
    patch.timezone = zone
  }

  if (input.country !== undefined) {
    const parsed = countrySchema.safeParse(input.country.trim())
    if (!parsed.success) return fail(firstIssue(parsed.error))
    patch.country = parsed.data.toUpperCase()
  }

  if (Object.keys(patch).length === 0) {
    return done("Nothing to change.", calendar.id)
  }

  const { error } = await db
    .from("booking_calendars")
    .update(patch)
    .eq("id", calendar.id)
    .eq("user_id", userId)

  if (error) return fail(TRY_AGAIN)

  refresh()
  return done("Saved. Salamat!", calendar.id)
}

/** Removes a calendar. Its hours, blackouts, questions and bookings go too. */
export async function deleteCalendar(
  calendarId: string
): Promise<BookingActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const calendar = await loadCalendar(db, userId, calendarId)
  if (!calendar) return fail(CALENDAR_NOT_FOUND)

  const { error } = await db
    .from("booking_calendars")
    .delete()
    .eq("id", calendar.id)
    .eq("user_id", userId)

  if (error) return fail("We could not delete that calendar. Please try again.")

  refresh()
  return done(`"${calendar.name}" is gone, along with its link.`)
}

/**
 * Turns the public link on or off.
 *
 * Publishing a calendar with no hours would hand out a link that can never be
 * booked, so that case is refused with the fix attached rather than allowed.
 */
export async function setPublished(input: {
  calendarId: string
  published: boolean
}): Promise<BookingActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const calendar = await loadCalendar(db, userId, input?.calendarId)
  if (!calendar) return fail(CALENDAR_NOT_FOUND)

  const published = input.published === true

  if (published) {
    const { data } = await db
      .from("booking_availability")
      .select("id")
      .eq("calendar_id", calendar.id)
      .eq("user_id", userId)
      .limit(1)

    if (((data as { id: string }[] | null) ?? []).length === 0) {
      return fail(
        "Set at least one day and time under Availability before you share this link."
      )
    }
  }

  const patch: Patch<"booking_calendars"> = { is_published: published }
  const { error } = await db
    .from("booking_calendars")
    .update(patch)
    .eq("id", calendar.id)
    .eq("user_id", userId)

  if (error) return fail(TRY_AGAIN)

  refresh()
  return done(
    published
      ? "Your link is live. Send it to your suki."
      : "Your link is off. Only you can see this calendar now.",
    calendar.id
  )
}

/** Changes the public link. Slugs are shared across every RaketShip account. */
export async function updateSlug(input: {
  calendarId: string
  slug: string
}): Promise<BookingActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const calendar = await loadCalendar(db, userId, input?.calendarId)
  if (!calendar) return fail(CALENDAR_NOT_FOUND)

  const value = String(input?.slug ?? "")
    .trim()
    .toLowerCase()

  const problem = validateSlug(value)
  if (problem) return fail(problem)

  if (value === calendar.slug.toLowerCase()) {
    return done("That is already your link.", calendar.id)
  }

  if (!(await slugIsFree(db, value))) return fail(SLUG_TAKEN)

  const patch: Patch<"booking_calendars"> = { slug: value }
  const { error } = await db
    .from("booking_calendars")
    .update(patch)
    .eq("id", calendar.id)
    .eq("user_id", userId)

  if (error) return fail(isUniqueViolation(error) ? SLUG_TAKEN : TRY_AGAIN)

  refresh()
  return done(
    "Your link is updated. The old one stops working, so re-share it.",
    calendar.id
  )
}

// =============================================================================
// Availability
// =============================================================================

/**
 * Replace-all: the editor sends the whole week each time, which keeps the
 * client free of per-row ids and makes "remove a range" the same code path as
 * "change one".
 */
export async function setAvailability(
  input: SetAvailabilityInput
): Promise<BookingActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const parsed = availabilitySchema.safeParse({
    calendarId: input?.calendarId,
    rules: input?.rules ?? [],
  })
  if (!parsed.success) return fail(firstIssue(parsed.error))

  // Checked before the ownership read so a plainly broken range comes back as
  // the sentence that fixes it, whatever the calendar turns out to be.
  const seen = new Set<string>()
  const rules: AvailabilityRule[] = []

  for (const rule of parsed.data.rules) {
    if (rule.endMinute <= rule.startMinute) {
      return fail(
        `${WEEKDAY_LABELS[rule.weekday]} needs an end time later than its start time.`
      )
    }
    const key = `${rule.weekday}:${rule.startMinute}:${rule.endMinute}`
    if (seen.has(key)) continue
    seen.add(key)
    rules.push(rule)
  }

  const calendar = await loadCalendar(db, userId, parsed.data.calendarId)
  if (!calendar) return fail(CALENDAR_NOT_FOUND)

  const rows: Insert<"booking_availability">[] = rules.map((rule) => ({
    calendar_id: calendar.id,
    user_id: userId,
    weekday: rule.weekday,
    start_minute: rule.startMinute,
    end_minute: rule.endMinute,
  }))

  const { error: clearError } = await db
    .from("booking_availability")
    .delete()
    .eq("calendar_id", calendar.id)
    .eq("user_id", userId)

  if (clearError) return fail("We could not save your hours. Please try again.")

  if (rows.length > 0) {
    const { error } = await db.from("booking_availability").insert(rows)
    if (error) return fail("We could not save your hours. Please try again.")
  }

  refresh()
  return done(
    rows.length > 0
      ? "Your days and hours are saved."
      : "Cleared. No days are open yet, so add one before you share the link.",
    calendar.id
  )
}

/** Closes one specific date, whatever the weekly rule says. */
export async function addBlackout(input: {
  calendarId: string
  date: string
  reason?: string
}): Promise<BookingActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const parsed = blackoutSchema.safeParse({
    calendarId: input?.calendarId,
    date: String(input?.date ?? "").trim(),
    reason: String(input?.reason ?? "").trim(),
  })
  if (!parsed.success) return fail(firstIssue(parsed.error))
  if (!isRealDate(parsed.data.date)) return fail("That date does not exist.")

  const calendar = await loadCalendar(db, userId, parsed.data.calendarId)
  if (!calendar) return fail(CALENDAR_NOT_FOUND)

  const payload: Insert<"booking_blackouts"> = {
    calendar_id: calendar.id,
    user_id: userId,
    date: parsed.data.date,
    reason: parsed.data.reason.length > 0 ? parsed.data.reason : null,
  }

  const { data, error } = await db
    .from("booking_blackouts")
    .insert(payload)
    .select("id")
    .maybeSingle()

  if (error) {
    // The (calendar_id, date) index makes a repeated tap harmless rather than
    // an error the user has to decode.
    if (isUniqueViolation(error)) return done("That date is already closed.")
    return fail("We could not close that date. Please try again.")
  }

  refresh()
  return done("That date is closed off.", (data as { id: string } | null)?.id)
}

/** Re-opens a date that was closed. */
export async function removeBlackout(
  blackoutId: string
): Promise<BookingActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  if (typeof blackoutId !== "string" || blackoutId.length === 0) {
    return fail("We could not find that date.")
  }

  const { error } = await db
    .from("booking_blackouts")
    .delete()
    .eq("id", blackoutId)
    .eq("user_id", userId)

  if (error) return fail("We could not re-open that date. Please try again.")

  refresh()
  return done("That date is open again.")
}

// =============================================================================
// Form fields
// =============================================================================

/** Adds a question, or edits one in place when `fieldId` is given. */
export async function saveField(
  input: SaveFieldInput
): Promise<BookingActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const parsed = fieldSchema.safeParse({
    calendarId: input?.calendarId,
    fieldId: input?.fieldId || undefined,
    label: String(input?.label ?? "").trim(),
    type: String(input?.type ?? "").trim(),
    help: String(input?.help ?? "").trim(),
    placeholder: String(input?.placeholder ?? "").trim(),
    required: input?.required === true,
    options: Array.isArray(input?.options) ? input.options : [],
  })
  if (!parsed.success) return fail(firstIssue(parsed.error))

  // The registry, not the client, decides what a type is and whether it needs
  // choices, so an unknown string never gets as far as the CHECK constraint.
  const def = getFieldType(parsed.data.type)
  if (!def) return fail("We do not know that kind of question.")

  const calendar = await loadCalendar(db, userId, parsed.data.calendarId)
  if (!calendar) return fail(CALENDAR_NOT_FOUND)

  const options = def.hasOptions ? cleanOptions(parsed.data.options) : []
  if (def.hasOptions && options.length === 0) {
    return fail(`Add at least one choice for "${parsed.data.label}".`)
  }

  const shared = {
    label: parsed.data.label,
    type: def.type,
    help: parsed.data.help.length > 0 ? parsed.data.help : null,
    placeholder:
      def.singleLine && parsed.data.placeholder.length > 0
        ? parsed.data.placeholder
        : null,
    required: parsed.data.required,
    options,
  }

  if (parsed.data.fieldId) {
    const patch: Patch<"booking_form_fields"> = shared
    const { data, error } = await db
      .from("booking_form_fields")
      .update(patch)
      .eq("id", parsed.data.fieldId)
      .eq("calendar_id", calendar.id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle()

    if (error) return fail("We could not save that question. Please try again.")
    if (!data) return fail("That question is no longer on this form.")

    refresh()
    return done("Question saved.", (data as { id: string }).id)
  }

  const { data: last } = await db
    .from("booking_form_fields")
    .select("position")
    .eq("calendar_id", calendar.id)
    .eq("user_id", userId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = ((last as { position: number } | null)?.position ?? -1) + 1

  const payload: Insert<"booking_form_fields"> = {
    calendar_id: calendar.id,
    user_id: userId,
    position,
    ...shared,
  }

  const { data, error } = await db
    .from("booking_form_fields")
    .insert(payload)
    .select("id")
    .maybeSingle()

  if (error) return fail("We could not add that question. Please try again.")

  refresh()
  return done("Question added.", (data as { id: string } | null)?.id)
}

/** Removes a question from the booking form. */
export async function deleteField(
  fieldId: string
): Promise<BookingActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  if (typeof fieldId !== "string" || fieldId.length === 0) {
    return fail("We could not find that question.")
  }

  const { error } = await db
    .from("booking_form_fields")
    .delete()
    .eq("id", fieldId)
    .eq("user_id", userId)

  if (error) return fail("We could not remove that question. Please try again.")

  refresh()
  return done("Question removed.")
}

/**
 * Writes the order the builder ended up with. Ids that do not belong to this
 * calendar are dropped rather than trusted, so a stale or forged list can only
 * ever reorder the caller's own questions.
 */
export async function reorderFields(input: {
  calendarId: string
  orderedIds: string[]
}): Promise<BookingActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const calendar = await loadCalendar(db, userId, input?.calendarId)
  if (!calendar) return fail(CALENDAR_NOT_FOUND)

  const requested = Array.isArray(input?.orderedIds) ? input.orderedIds : []
  if (requested.length === 0) return done("Nothing to reorder.", calendar.id)

  const { data } = await db
    .from("booking_form_fields")
    .select("id")
    .eq("calendar_id", calendar.id)
    .eq("user_id", userId)

  const mine = new Set(
    ((data as { id: string }[] | null) ?? []).map((row) => row.id)
  )
  const ordered = requested.filter((id) => mine.has(id))
  if (ordered.length === 0) return fail("Those questions are no longer here.")

  for (let index = 0; index < ordered.length; index++) {
    const patch: Patch<"booking_form_fields"> = { position: index }
    const { error } = await db
      .from("booking_form_fields")
      .update(patch)
      .eq("id", ordered[index])
      .eq("calendar_id", calendar.id)
      .eq("user_id", userId)
    if (error) return fail("We could not save that order. Please try again.")
  }

  refresh()
  return done("Order saved.", calendar.id)
}

// -----------------------------------------------------------------------------
// Length: one fixed length, or a catalogue of services
// -----------------------------------------------------------------------------

const lengthModeSchema = z.enum(["fixed", "catalog"], {
  message: "Pick either one fixed length or a service list.",
})

const priceSchema = z
  .number()
  .int("Prices are whole centavos.")
  .min(0, "A price cannot be negative.")
  .max(100_000_000, "That price is too large.")

const serviceSchema = z.object({
  name: z
    .string()
    .min(2, "Give this service a name, at least 2 characters.")
    .max(80, "Keep the name under 80 characters."),
  description: z.string().max(300, "Keep the description under 300 characters."),
  priceCentavos: priceSchema,
  // Same bounds as a fixed length: a service IS the length once it is chosen.
  durationMinutes: durationSchema,
})

export interface SaveServiceInput {
  calendarId: string
  /** Omit to add a new service; pass it to edit one in place. */
  serviceId?: string
  name: string
  description?: string
  priceCentavos: number
  durationMinutes: number
  isActive?: boolean
}

/**
 * Switches between one length for everything and a list of services.
 *
 * Turning on the catalogue while it is empty would leave the public page with
 * nothing to offer and no way to reach a date, so that is refused here rather
 * than discovered by a customer.
 */
export async function setLengthMode(input: {
  calendarId: string
  mode: string
}): Promise<BookingActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const calendar = await loadCalendar(db, userId, input?.calendarId)
  if (!calendar) return fail(CALENDAR_NOT_FOUND)

  const parsed = lengthModeSchema.safeParse(input?.mode)
  if (!parsed.success) return fail(firstIssue(parsed.error))
  const mode = parsed.data

  if (mode === "catalog") {
    const { count } = await db
      .from("booking_services")
      .select("id", { count: "exact", head: true })
      .eq("calendar_id", calendar.id)
      .eq("user_id", userId)
      .eq("is_active", true)

    if ((count ?? 0) === 0) {
      return fail("Add at least one service before switching to a service list.")
    }
  }

  const patch: Patch<"booking_calendars"> = { length_mode: mode }
  const { error } = await db
    .from("booking_calendars")
    .update(patch)
    .eq("id", calendar.id)
    .eq("user_id", userId)

  if (error) return fail(TRY_AGAIN)

  refresh()
  return done(
    mode === "catalog"
      ? "Your suki picks a service first."
      : "Every booking now runs the same length.",
    calendar.id
  )
}

/** Adds a service, or edits one in place when serviceId is passed. */
export async function saveService(
  input: SaveServiceInput
): Promise<BookingActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const calendar = await loadCalendar(db, userId, input?.calendarId)
  if (!calendar) return fail(CALENDAR_NOT_FOUND)

  const parsed = serviceSchema.safeParse({
    name: (input?.name ?? "").trim(),
    description: (input?.description ?? "").trim(),
    priceCentavos: input?.priceCentavos ?? 0,
    durationMinutes: input?.durationMinutes ?? 0,
  })
  if (!parsed.success) return fail(firstIssue(parsed.error))

  const { name, description, priceCentavos, durationMinutes } = parsed.data
  const isActive = input?.isActive ?? true

  if (typeof input?.serviceId === "string" && input.serviceId.length > 0) {
    const patch: Patch<"booking_services"> = {
      name,
      description: description.length > 0 ? description : null,
      price_centavos: priceCentavos,
      duration_minutes: durationMinutes,
      is_active: isActive,
    }
    const { error } = await db
      .from("booking_services")
      .update(patch)
      .eq("id", input.serviceId)
      .eq("calendar_id", calendar.id)
      .eq("user_id", userId)

    if (error) return fail("We could not save that service. Please try again.")

    refresh()
    return done("Service saved.", input.serviceId)
  }

  // New services land at the end of the list.
  const { data: last } = await db
    .from("booking_services")
    .select("position")
    .eq("calendar_id", calendar.id)
    .eq("user_id", userId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = ((last as { position: number } | null)?.position ?? -1) + 1

  const row: Insert<"booking_services"> = {
    calendar_id: calendar.id,
    user_id: userId,
    name,
    description: description.length > 0 ? description : null,
    price_centavos: priceCentavos,
    duration_minutes: durationMinutes,
    position,
    is_active: isActive,
  }

  const { data, error } = await db
    .from("booking_services")
    .insert(row)
    .select("id")
    .single()

  if (error) return fail("We could not add that service. Please try again.")

  refresh()
  return done("Service added.", (data as { id: string } | null)?.id)
}

/**
 * Removes a service. Bookings already taken on it keep the name and price they
 * were sold at — the database nulls only the reference, never the snapshot.
 *
 * Deleting the last one falls the calendar back to a single fixed length, so a
 * live page is never left with an empty list and no way forward.
 */
export async function deleteService(
  serviceId: string
): Promise<BookingActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  if (typeof serviceId !== "string" || serviceId.length === 0) {
    return fail("We could not find that service.")
  }

  const { data: existing } = await db
    .from("booking_services")
    .select("calendar_id")
    .eq("id", serviceId)
    .eq("user_id", userId)
    .maybeSingle()

  const calendarId = (existing as { calendar_id: string } | null)?.calendar_id
  if (!calendarId) return fail("We could not find that service.")

  const { error } = await db
    .from("booking_services")
    .delete()
    .eq("id", serviceId)
    .eq("user_id", userId)

  if (error) return fail("We could not remove that service. Please try again.")

  const { count } = await db
    .from("booking_services")
    .select("id", { count: "exact", head: true })
    .eq("calendar_id", calendarId)
    .eq("user_id", userId)
    .eq("is_active", true)

  if ((count ?? 0) === 0) {
    const patch: Patch<"booking_calendars"> = { length_mode: "fixed" }
    await db
      .from("booking_calendars")
      .update(patch)
      .eq("id", calendarId)
      .eq("user_id", userId)
  }

  refresh()
  return done("Service removed.")
}

/** Writes the order the catalogue ended up with. Foreign ids are dropped. */
export async function reorderServices(input: {
  calendarId: string
  orderedIds: string[]
}): Promise<BookingActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  const calendar = await loadCalendar(db, userId, input?.calendarId)
  if (!calendar) return fail(CALENDAR_NOT_FOUND)

  const requested = Array.isArray(input?.orderedIds) ? input.orderedIds : []
  if (requested.length === 0) return done("Nothing to reorder.", calendar.id)

  const { data } = await db
    .from("booking_services")
    .select("id")
    .eq("calendar_id", calendar.id)
    .eq("user_id", userId)

  const mine = new Set(
    ((data as { id: string }[] | null) ?? []).map((row) => row.id)
  )
  const ordered = requested.filter((id) => mine.has(id))
  if (ordered.length === 0) return fail("Those services are no longer here.")

  for (let index = 0; index < ordered.length; index++) {
    const patch: Patch<"booking_services"> = { position: index }
    const { error } = await db
      .from("booking_services")
      .update(patch)
      .eq("id", ordered[index])
      .eq("calendar_id", calendar.id)
      .eq("user_id", userId)
    if (error) return fail("We could not save that order. Please try again.")
  }

  refresh()
  return done("Order saved.", calendar.id)
}

// -----------------------------------------------------------------------------
// Bookings that came in through the public page
// -----------------------------------------------------------------------------

/**
 * Cancels a booking, which hands its slot back.
 *
 * The row is kept rather than deleted: someone turned up in the owner's diary
 * and then did not, and that is worth being able to look at. Setting the status
 * is also what releases the time — `getTakenSlots` counts only confirmed rows,
 * and the no-double-booking index is `where status = 'confirmed'` — so a
 * cancelled slot becomes bookable again by both of the things that decide.
 */
export async function cancelBooking(
  bookingId: string
): Promise<BookingActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  if (typeof bookingId !== "string" || bookingId.length === 0) {
    return fail("We could not find that booking.")
  }

  const patch: Patch<"bookings"> = { status: "cancelled" }
  const { error } = await db
    .from("bookings")
    .update(patch)
    .eq("id", bookingId)
    // Scoped by the session, never by an id from the browser.
    .eq("user_id", userId)

  if (error) return fail("We could not cancel that booking. Pakisubukan ulit.")

  refresh()
  return done("Cancelled. Bukás na ulit ang oras na iyon.")
}

/** Puts a cancelled booking back, if the slot has not been taken since. */
export async function restoreBooking(
  bookingId: string
): Promise<BookingActionResult> {
  const session = await requireSession()
  if ("error" in session) return session.error
  const { db, userId } = session

  if (typeof bookingId !== "string" || bookingId.length === 0) {
    return fail("We could not find that booking.")
  }

  const patch: Patch<"bookings"> = { status: "confirmed" }
  const { error } = await db
    .from("bookings")
    .update(patch)
    .eq("id", bookingId)
    .eq("user_id", userId)

  if (error) {
    // The partial unique index fires when somebody else took the slot in the
    // meantime, which is the one failure worth explaining rather than blaming
    // on the network.
    return fail(
      isUniqueViolation(error)
        ? "May kumuha na ng oras na iyon. Hindi na ito maibabalik."
        : "We could not restore that booking. Pakisubukan ulit."
    )
  }

  refresh()
  return done("Nakabalik na ang booking.")
}

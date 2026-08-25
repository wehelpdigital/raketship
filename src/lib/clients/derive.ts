import { answerToText, type AnswerValue } from "@/lib/booking/fields"
import type { BookingFormFieldRow } from "@/lib/supabase/types"
import type { OwnerBooking } from "@/lib/queries/booking"

/**
 * Turning a pile of bookings into a list of PEOPLE.
 *
 * The Client Manager owns no table: the bookings rows already hold every fact
 * a client has given, and a second copy would drift from the first the day a
 * booking was cancelled in one place and not the other. So a "client" is
 * derived — the same person's bookings folded together — and is always
 * exactly as current as the bookings are.
 *
 * Pure, so the folding is testable without a database.
 */

export interface ClientAnswer {
  /** The owner's own question, as they wrote it. */
  label: string
  value: string
}

export interface ClientRecord {
  /** Stable identity key — see identityOf. */
  key: string
  name: string
  email: string | null
  phone: string | null
  /** Confirmed bookings, past and future. */
  bookings: number
  cancelled: number
  /** Sum of the price snapshots on confirmed bookings. */
  totalCentavos: number
  /** ISO instants of the earliest and latest bookings, cancelled included. */
  firstAt: string
  lastAt: string
  /** Names of every calendar this person has booked, alphabetical. */
  calendars: string[]
  /**
   * The latest non-empty answer to each of the owner's questions, labelled
   * with the question. The columns of this CRM are whatever the owner asked —
   * the shape adapts to the form, not the form to the shape.
   */
  answers: ClientAnswer[]
}

/**
 * Who a booking belongs to.
 *
 * Email first — it is the strongest identity a public form collects. Then the
 * phone's digits, so "0917 123 4567" and "09171234567" are one person. The
 * name alone is last resort: two Maria Santoses with no contact details WILL
 * fold together, and with nothing else to tell them apart, so would a human.
 */
export function identityOf(booking: {
  customer_email: string | null
  customer_phone: string | null
  customer_name: string
}): string {
  const email = booking.customer_email?.trim().toLowerCase()
  if (email) return `email:${email}`
  const digits = (booking.customer_phone ?? "").replace(/\D/g, "")
  if (digits) return `phone:${digits}`
  return `name:${booking.customer_name.trim().toLowerCase()}`
}

export function deriveClients(
  bookings: OwnerBooking[],
  fieldsByCalendar: Record<string, BookingFormFieldRow[]>
): ClientRecord[] {
  /*
    Oldest first, so "latest wins" is a plain overwrite: the person's current
    name, number and answers are whatever they said most recently.
  */
  const ordered = [...bookings].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const byKey = new Map<
    string,
    ClientRecord & { answerByLabel: Map<string, string> }
  >()

  for (const booking of ordered) {
    const key = identityOf(booking)
    const cancelled = booking.status === "cancelled"

    let record = byKey.get(key)
    if (!record) {
      record = {
        key,
        name: booking.customer_name,
        email: booking.customer_email,
        phone: booking.customer_phone,
        bookings: 0,
        cancelled: 0,
        totalCentavos: 0,
        firstAt: booking.starts_at,
        lastAt: booking.starts_at,
        calendars: [],
        answers: [],
        answerByLabel: new Map(),
      }
      byKey.set(key, record)
    }

    record.name = booking.customer_name
    record.email = booking.customer_email ?? record.email
    record.phone = booking.customer_phone ?? record.phone

    if (cancelled) record.cancelled += 1
    else {
      record.bookings += 1
      record.totalCentavos += booking.service_price_centavos ?? 0
    }

    if (booking.starts_at < record.firstAt) record.firstAt = booking.starts_at
    if (booking.starts_at > record.lastAt) record.lastAt = booking.starts_at

    const calendarName = booking.calendar?.name ?? "Booking"
    if (!record.calendars.includes(calendarName)) {
      record.calendars.push(calendarName)
    }

    // Only questions this calendar actually asked, and only answered ones —
    // an empty answer must not blank out an earlier real one.
    const fields = fieldsByCalendar[booking.calendar_id] ?? []
    const answers = (booking.answers ?? {}) as Record<string, AnswerValue>
    for (const field of fields) {
      const text = answerToText(answers[field.id] ?? null)
      if (text.length > 0) record.answerByLabel.set(field.label, text)
    }
  }

  return [...byKey.values()]
    .map(({ answerByLabel, ...record }) => ({
      ...record,
      calendars: [...record.calendars].sort((a, b) => a.localeCompare(b)),
      answers: [...answerByLabel.entries()].map(([label, value]) => ({
        label,
        value,
      })),
    }))
    // The person you dealt with most recently first — this is a working list.
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
}

/** Everything about a client worth typing into a search box. */
export function clientHaystack(client: ClientRecord): string {
  const phone = client.phone ?? ""
  return [
    client.name,
    client.email ?? "",
    phone,
    phone.replace(/\D/g, ""),
    client.calendars.join(" "),
    client.answers.map((a) => `${a.label} ${a.value}`).join(" "),
  ]
    .join(" ")
    .toLowerCase()
}

export function clientMatches(client: ClientRecord, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = clientHaystack(client)
  return q.split(/\s+/).every((word) => haystack.includes(word))
}

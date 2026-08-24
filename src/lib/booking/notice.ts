/**
 * Saying how much warning something needs.
 *
 * Shared because the owner picks the number on one screen and a suki reads it
 * on another, and the two describing "24" differently would be the sort of
 * mismatch nobody notices until a customer counts wrong.
 */

/** The choices offered for a cancellation deadline. */
export const CANCEL_NOTICES = [0, 1, 2, 4, 12, 24, 48, 72, 168] as const

/**
 * "1 oras", "2 araw", "1 linggo" — the unit people would actually say.
 *
 * Written in Filipino because the only place it is read out loud is the
 * public page, which is.
 */
export function hoursLabel(hours: number): string {
  const whole = Math.max(0, Math.round(hours))
  if (whole === 0) return "kahit kailan"
  if (whole < 24) return whole === 1 ? "1 oras" : `${whole} oras`

  const days = Math.round(whole / 24)
  if (days % 7 === 0) {
    const weeks = days / 7
    return weeks === 1 ? "1 linggo" : `${weeks} linggo`
  }
  return days === 1 ? "1 araw" : `${days} araw`
}

/** The same span for the owner's own settings screen, in the app's voice. */
export function cancelNoticeLabel(hours: number): string {
  const whole = Math.max(0, Math.round(hours))
  if (whole === 0) return "No deadline"
  if (whole < 24) return whole === 1 ? "1 hour before" : `${whole} hours before`

  const days = Math.round(whole / 24)
  if (days % 7 === 0) {
    const weeks = days / 7
    return weeks === 1 ? "1 week before" : `${weeks} weeks before`
  }
  return days === 1 ? "1 day before" : `${days} days before`
}

/**
 * What the confirmation asks of a suki who needs to change their plans.
 *
 * Zero gets no number rather than "at least 0 hours", which is both nonsense
 * and slightly rude. Nothing enforces any of this — a public booking has no
 * account behind it — so the sentence asks rather than warns.
 */
export function cancelNoticeSentence(hours: number): string {
  const whole = Math.max(0, Math.round(hours))
  if (whole === 0) return "Mag-message lang po sa amin."
  return `Pakisabi po sa amin nang hindi bababa sa ${hoursLabel(whole)} bago ang appointment.`
}

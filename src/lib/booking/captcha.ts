import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

import { leadingZeroBits, sha256Hex } from "@/lib/booking/sha256"

/**
 * Proving a booking came from a person.
 *
 * Not a third-party captcha. Those want an account, two API keys and a script
 * served from someone else's domain onto a page that Filipino MSMEs open on
 * mobile data — and this app has to keep working when nothing is configured at
 * all. So the challenge is minted and checked here, and there is nothing for a
 * raketero to sign up for.
 *
 * Four things have to hold before a booking is written, and each catches a
 * different kind of caller:
 *
 *   1. The token is one WE issued and has not been edited — an HMAC over the
 *      whole payload, compared in constant time.
 *   2. It is recent. A token minted last month is not somebody filling in a
 *      form.
 *   3. It has been spent on some WORK: a small proof-of-work the browser
 *      solves in about a tenth of a second and a script pays for on every
 *      single attempt. This is what makes volume expensive rather than free.
 *   4. It is used once. The signature cannot give that on its own, so the
 *      nonce is consumed in `booking_challenges` — see 0011.
 *
 * There is a fifth, cheaper check in the form itself: a honeypot field and the
 * time between the page loading and the submit arriving. Those cost nothing and
 * catch the naive bots that never run any JavaScript.
 */

/** How long a challenge stays good for. Long enough to fill a form slowly. */
export const CHALLENGE_TTL_MS = 45 * 60 * 1000

/**
 * Leading zero BITS the proof-of-work must produce.
 *
 * 16 bits is ~65k hashes: a few tens of milliseconds in a phone browser, and
 * unavoidable on every attempt for anyone submitting in bulk. Higher would
 * start costing real people on cheap Android hardware, which is most of them.
 */
export const CHALLENGE_BITS = 16

/** Below this, the form was filled faster than a person can read it. */
export const MIN_FILL_MS = 2500

export interface Challenge {
  nonce: string
  issuedAt: number
  signature: string
}

/**
 * The signing secret.
 *
 * SUPABASE_SECRET_KEY is already server-only and already fatal to leak, so it
 * doubles as the HMAC key rather than inventing a second thing to configure.
 * When it is absent — an unconfigured checkout — a per-process random key is
 * used instead: the app still runs, tokens still verify within that process,
 * and nothing has to be set up to look at the booking page.
 */
let fallbackSecret: string | null = null

function secret(): string {
  const configured = process.env.SUPABASE_SECRET_KEY?.trim()
  if (configured) return configured
  fallbackSecret ??= randomBytes(32).toString("hex")
  return fallbackSecret
}

function sign(nonce: string, issuedAt: number): string {
  return createHmac("sha256", secret())
    .update(`${nonce}.${issuedAt}`)
    .digest("hex")
}

/** A fresh challenge for one visit to a booking page. */
export function issueChallenge(now: number = Date.now()): Challenge {
  const nonce = randomBytes(16).toString("hex")
  return { nonce, issuedAt: now, signature: sign(nonce, now) }
}

/** Compares without leaking where two strings first differ. */
function sameSignature(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8")
  const right = Buffer.from(b, "utf8")
  // timingSafeEqual throws on a length mismatch, which would itself be a leak,
  // so the lengths are checked first and the comparison still runs.
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * The work a browser has to do: find a counter that hashes small enough.
 *
 * Shared with the browser rather than reimplemented, so the two cannot score
 * the same solution differently and reject work that was actually done.
 */
export function solutionHash(nonce: string, counter: number): string {
  return sha256Hex(`${nonce}:${counter}`)
}

export { leadingZeroBits }

export type CaptchaFailure =
  | "missing"
  | "malformed"
  | "bad_signature"
  | "expired"
  | "not_yet"
  | "weak_solution"
  | "too_fast"
  | "honeypot"

export interface CaptchaSubmission {
  nonce?: unknown
  issuedAt?: unknown
  signature?: unknown
  /** The counter the browser found. */
  solution?: unknown
  /** A field no person can see, so anything in it was typed by a script. */
  honeypot?: unknown
}

export type CaptchaResult =
  | { ok: true; nonce: string }
  | { ok: false; reason: CaptchaFailure }

/**
 * Everything except single use, which needs the database.
 *
 * Deliberately returns a REASON rather than a message: the caller decides how
 * much to say, and telling a script precisely which check it failed is telling
 * it what to fix.
 */
export function verifyChallenge(
  submission: CaptchaSubmission,
  now: number = Date.now()
): CaptchaResult {
  if (submission?.honeypot) return { ok: false, reason: "honeypot" }

  const nonce = submission?.nonce
  const issuedAt = Number(submission?.issuedAt)
  const signature = submission?.signature
  const solution = Number(submission?.solution)

  if (typeof nonce !== "string" || typeof signature !== "string") {
    return { ok: false, reason: "missing" }
  }
  if (!/^[0-9a-f]{32}$/.test(nonce) || !/^[0-9a-f]{64}$/.test(signature)) {
    return { ok: false, reason: "malformed" }
  }
  if (!Number.isFinite(issuedAt) || !Number.isInteger(issuedAt)) {
    return { ok: false, reason: "malformed" }
  }
  if (!Number.isFinite(solution) || !Number.isInteger(solution) || solution < 0) {
    return { ok: false, reason: "malformed" }
  }

  if (!sameSignature(signature, sign(nonce, issuedAt))) {
    return { ok: false, reason: "bad_signature" }
  }

  const age = now - issuedAt
  // A token from the future is a clock that disagrees, or a forgery attempt
  // against a signature we would otherwise have accepted forever.
  if (age < -60_000) return { ok: false, reason: "not_yet" }
  if (age > CHALLENGE_TTL_MS) return { ok: false, reason: "expired" }
  if (age < MIN_FILL_MS) return { ok: false, reason: "too_fast" }

  if (leadingZeroBits(solutionHash(nonce, solution)) < CHALLENGE_BITS) {
    return { ok: false, reason: "weak_solution" }
  }

  return { ok: true, nonce }
}

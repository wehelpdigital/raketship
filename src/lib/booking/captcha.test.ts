import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  CHALLENGE_BITS,
  CHALLENGE_TTL_MS,
  issueChallenge,
  leadingZeroBits,
  MIN_FILL_MS,
  solutionHash,
  verifyChallenge,
} from "./captcha"

/** The work a browser does, done here so the tests submit real solutions. */
function solve(nonce: string, bits = CHALLENGE_BITS): number {
  for (let counter = 0; counter < 5_000_000; counter++) {
    if (leadingZeroBits(solutionHash(nonce, counter)) >= bits) return counter
  }
  throw new Error("no solution found")
}

const NOW = 1_800_000_000_000

function submissionFor(now = NOW) {
  const challenge = issueChallenge(now)
  return {
    ...challenge,
    solution: solve(challenge.nonce),
    honeypot: "",
  }
}

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret-for-signing")
})

describe("leadingZeroBits", () => {
  it("counts a whole nibble at a time, then the partial one", () => {
    expect(leadingZeroBits("0000ffff")).toBe(16)
    expect(leadingZeroBits("00001fff")).toBe(19)
    expect(leadingZeroBits("ffffffff")).toBe(0)
    expect(leadingZeroBits("8fffffff")).toBe(0)
    expect(leadingZeroBits("4fffffff")).toBe(1)
    expect(leadingZeroBits("2fffffff")).toBe(2)
    expect(leadingZeroBits("1fffffff")).toBe(3)
  })

  it("handles an all-zero digest without running off the end", () => {
    expect(leadingZeroBits("0".repeat(64))).toBe(256)
  })
})

describe("a genuine submission", () => {
  it("passes once the form has been open long enough", () => {
    const submission = submissionFor()
    const result = verifyChallenge(submission, NOW + MIN_FILL_MS + 1000)
    expect(result.ok).toBe(true)
  })

  it("hands back the nonce, which is what gets spent", () => {
    const submission = submissionFor()
    const result = verifyChallenge(submission, NOW + MIN_FILL_MS + 1000)
    expect(result.ok && result.nonce).toBe(submission.nonce)
  })
})

describe("what it turns away", () => {
  const at = NOW + MIN_FILL_MS + 1000

  it("a token nobody issued", () => {
    const submission = submissionFor()
    const forged = { ...submission, signature: "a".repeat(64) }
    expect(verifyChallenge(forged, at)).toEqual({
      ok: false,
      reason: "bad_signature",
    })
  })

  it("a token whose timestamp was edited to keep it alive", () => {
    // The signature covers the time, so moving it invalidates the whole thing.
    const submission = submissionFor()
    const stretched = { ...submission, issuedAt: at }
    expect(verifyChallenge(stretched, at).ok).toBe(false)
  })

  it("a token whose nonce was swapped for another", () => {
    const mine = submissionFor()
    const other = issueChallenge(NOW)
    expect(
      verifyChallenge({ ...mine, nonce: other.nonce }, at).ok
    ).toBe(false)
  })

  it("a solution that did no work", () => {
    const submission = submissionFor()
    expect(verifyChallenge({ ...submission, solution: 0 }, at)).toEqual({
      ok: false,
      reason: "weak_solution",
    })
  })

  it("a form submitted faster than a person can read it", () => {
    const submission = submissionFor()
    expect(verifyChallenge(submission, NOW + 200)).toEqual({
      ok: false,
      reason: "too_fast",
    })
  })

  it("a token left over from an hour ago", () => {
    const submission = submissionFor()
    expect(verifyChallenge(submission, NOW + CHALLENGE_TTL_MS + 1)).toEqual({
      ok: false,
      reason: "expired",
    })
  })

  it("a token dated in the future", () => {
    const submission = submissionFor(NOW + 10 * 60_000)
    const result = verifyChallenge(submission, NOW)
    expect(result).toEqual({ ok: false, reason: "not_yet" })
  })

  it("anything at all in the honeypot", () => {
    // No person can see that field, so a value in it was typed by a script.
    const submission = submissionFor()
    expect(
      verifyChallenge({ ...submission, honeypot: "https://spam" }, at)
    ).toEqual({ ok: false, reason: "honeypot" })
  })

  it("a submission with nothing in it", () => {
    expect(verifyChallenge({}, at).ok).toBe(false)
    expect(verifyChallenge({ nonce: null, signature: null }, at).ok).toBe(false)
  })

  it("shapes that are the right type but the wrong thing", () => {
    const submission = submissionFor()
    for (const bad of [
      { ...submission, nonce: "not-hex" },
      { ...submission, nonce: "abc" },
      { ...submission, signature: "abc" },
      { ...submission, issuedAt: "yesterday" },
      { ...submission, issuedAt: 1.5 },
      { ...submission, solution: -1 },
      { ...submission, solution: 1.5 },
      { ...submission, solution: Number.NaN },
    ]) {
      expect(verifyChallenge(bad, at).ok, JSON.stringify(bad.nonce)).toBe(false)
    }
  })

  it("never throws, whatever it is handed", () => {
    for (const junk of [
      {},
      { nonce: 123 },
      { nonce: {}, signature: [] },
      { nonce: "a".repeat(32), signature: "b".repeat(64), issuedAt: Infinity },
    ]) {
      expect(() => verifyChallenge(junk as never, at)).not.toThrow()
    }
  })
})

describe("the signature is bound to this deployment", () => {
  it("refuses a token signed with a different secret", () => {
    const submission = submissionFor()

    // Same token, different server.
    vi.stubEnv("SUPABASE_SECRET_KEY", "a-completely-different-secret")
    expect(verifyChallenge(submission, NOW + MIN_FILL_MS + 1000)).toEqual({
      ok: false,
      reason: "bad_signature",
    })
  })

  it("still issues and verifies when nothing is configured", () => {
    // An unconfigured checkout must still render and exercise the booking page
    // rather than failing at import time.
    vi.stubEnv("SUPABASE_SECRET_KEY", "")
    const challenge = issueChallenge(NOW)
    const result = verifyChallenge(
      { ...challenge, solution: solve(challenge.nonce), honeypot: "" },
      NOW + MIN_FILL_MS + 1000
    )
    expect(result.ok).toBe(true)
  })
})

describe("the work itself", () => {
  it("is real but small", () => {
    // If this ever got slow, it would be slow on the cheap Android phone that
    // most suki are holding.
    const challenge = issueChallenge(NOW)
    const started = performance.now()
    const counter = solve(challenge.nonce)
    const took = performance.now() - started

    expect(leadingZeroBits(solutionHash(challenge.nonce, counter))).toBeGreaterThanOrEqual(
      CHALLENGE_BITS
    )
    expect(took).toBeLessThan(3000)
  })

  it("is different for every challenge, so one answer does not fit all", () => {
    const a = issueChallenge(NOW)
    const b = issueChallenge(NOW)
    expect(a.nonce).not.toBe(b.nonce)

    const solutionForA = solve(a.nonce)
    // Vanishingly unlikely to also solve b — and if it did, b's own signature
    // still would not match a's.
    expect(
      verifyChallenge(
        { ...b, solution: solutionForA },
        NOW + MIN_FILL_MS + 1000
      ).ok
    ).toBe(false)
  })
})

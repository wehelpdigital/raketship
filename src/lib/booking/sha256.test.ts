import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"

import { leadingZeroBits, sha256Hex } from "./sha256"

/** The reference. If ours disagrees with this, ours is wrong. */
const reference = (input: string) =>
  createHash("sha256").update(input, "utf8").digest("hex")

describe("sha256Hex", () => {
  it("matches the published vectors", () => {
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )
    expect(
      sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")
    ).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1")
  })

  it("agrees with node:crypto on the lengths around a block boundary", () => {
    // 55, 56 and 64 are where the padding rules change, and where a hand-rolled
    // implementation goes wrong if it is going to.
    for (const length of [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128]) {
      const input = "a".repeat(length)
      expect(sha256Hex(input), `length ${length}`).toBe(reference(input))
    }
  })

  it("agrees on the strings this is actually used for", () => {
    for (let counter = 0; counter < 200; counter++) {
      const input = `deadbeefdeadbeefdeadbeefdeadbeef:${counter}`
      expect(sha256Hex(input)).toBe(reference(input))
    }
  })

  it("handles characters that are more than one byte", () => {
    // The app's own copy is bilingual and a customer name can be anything.
    for (const input of ["ñ", "Piliin ang petsa", "🇵🇭 raket", "日本語"]) {
      expect(sha256Hex(input), input).toBe(reference(input))
    }
  })

  it("agrees on a long input, where the bit-length spans two words", () => {
    const input = "x".repeat(10_000)
    expect(sha256Hex(input)).toBe(reference(input))
  })

  it("is deterministic", () => {
    expect(sha256Hex("raketship")).toBe(sha256Hex("raketship"))
  })
})

describe("leadingZeroBits", () => {
  it("counts nibbles then the partial one", () => {
    expect(leadingZeroBits("0000ffff")).toBe(16)
    expect(leadingZeroBits("00001fff")).toBe(19)
    expect(leadingZeroBits("ffffffff")).toBe(0)
    expect(leadingZeroBits("1fffffff")).toBe(3)
  })

  it("agrees with the server's copy of the same rule", async () => {
    // The browser scores its own work with this; the server re-scores it with
    // its own. If the two ever disagreed, real solutions would be rejected.
    const server = await import("./captcha")
    for (const digest of [
      "0000ffff",
      "00001fff",
      "ffffffff",
      "8000abcd",
      "4000abcd",
      "2000abcd",
      "0".repeat(64),
    ]) {
      expect(leadingZeroBits(digest), digest).toBe(server.leadingZeroBits(digest))
    }
  })
})

describe("the work is cheap enough for a phone", () => {
  it("finds a 16-bit solution quickly", () => {
    const started = performance.now()
    let counter = 0
    while (leadingZeroBits(sha256Hex(`nonce-for-timing:${counter}`)) < 16) {
      counter++
      if (counter > 5_000_000) throw new Error("no solution")
    }
    const took = performance.now() - started

    // Generous, because CI machines are not fast. The point is that it is not
    // minutes: a suki on a cheap Android holds this for a moment, a script
    // pays it on every single attempt.
    expect(took).toBeLessThan(10_000)
  })
})

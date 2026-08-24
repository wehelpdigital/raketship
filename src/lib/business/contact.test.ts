import { describe, expect, it } from "vitest"

import { normalisePhMobile, tidyHandle, tidyUrl, toInternational } from "./contact"

describe("normalisePhMobile", () => {
  it("accepts the ways people actually type a number", () => {
    const expected = "09171234567"
    expect(normalisePhMobile("09171234567")).toBe(expected)
    expect(normalisePhMobile("+639171234567")).toBe(expected)
    expect(normalisePhMobile("639171234567")).toBe(expected)
    expect(normalisePhMobile("9171234567")).toBe(expected)
    expect(normalisePhMobile("0917 123 4567")).toBe(expected)
    expect(normalisePhMobile("0917-123-4567")).toBe(expected)
    expect(normalisePhMobile("(0917) 123 4567")).toBe(expected)
  })

  it("normalises rather than merely accepting", () => {
    // Three spellings of one number would otherwise read as three shops.
    const forms = ["09171234567", "+639171234567", "0917 123 4567"]
    const normalised = new Set(forms.map((f) => normalisePhMobile(f)))
    expect(normalised.size).toBe(1)
  })

  it("refuses what is not a PH mobile", () => {
    expect(normalisePhMobile("")).toBeNull()
    expect(normalisePhMobile("1234")).toBeNull()
    expect(normalisePhMobile("0817123456")).toBeNull()
    expect(normalisePhMobile("091712345678")).toBeNull()
    expect(normalisePhMobile("+14155551234")).toBeNull()
    expect(normalisePhMobile("tawagan mo ako")).toBeNull()
  })
})

describe("toInternational", () => {
  it("gives chat apps the form they expect", () => {
    expect(toInternational("09171234567")).toBe("+639171234567")
    expect(toInternational("639171234567")).toBe("+639171234567")
  })

  it("round-trips with normalisePhMobile", () => {
    expect(normalisePhMobile(toInternational("09171234567"))).toBe("09171234567")
  })
})

describe("tidyUrl", () => {
  it("adds the scheme people do not type", () => {
    expect(tidyUrl("facebook.com/gupitninena")).toBe(
      "https://facebook.com/gupitninena"
    )
    expect(tidyUrl("shopee.ph/shop")).toBe("https://shopee.ph/shop")
  })

  it("keeps a scheme that is already there", () => {
    expect(tidyUrl("https://example.com/x")).toBe("https://example.com/x")
    expect(tidyUrl("http://example.com/")).toBe("http://example.com/")
  })

  it("refuses a scheme that is not the web", () => {
    // These end up in an href on a page anyone can open, so a javascript: or
    // data: URL here is an XSS vector rather than a typo.
    expect(tidyUrl("javascript:alert(1)")).toBeNull()
    expect(tidyUrl("JavaScript:alert(1)")).toBeNull()
    expect(tidyUrl("data:text/html,<script>alert(1)</script>")).toBeNull()
    expect(tidyUrl("vbscript:msgbox(1)")).toBeNull()
    expect(tidyUrl("file:///etc/passwd")).toBeNull()
  })

  it("does not rescue a bad scheme by prefixing it", () => {
    // The naive version tests for http(s) first and then prefixes, which turns
    // "javascript:alert(1)" into a URL that parses and passes.
    expect(tidyUrl("javascript:alert(1)")).toBeNull()
    // ...and the guard is not so broad that it eats a real host that merely
    // begins with the same letters.
    expect(tidyUrl("javascript.info/tutorial")).toBe(
      "https://javascript.info/tutorial"
    )
  })

  it("refuses something that is not a host", () => {
    expect(tidyUrl("")).toBeNull()
    expect(tidyUrl("   ")).toBeNull()
    expect(tidyUrl("localhost")).toBeNull()
    expect(tidyUrl("hello world")).toBeNull()
  })
})

describe("tidyHandle", () => {
  it("takes the handle however it was given", () => {
    expect(tidyHandle("aling.nena")).toBe("aling.nena")
    expect(tidyHandle("@aling.nena")).toBe("aling.nena")
    expect(tidyHandle("https://instagram.com/aling.nena")).toBe("aling.nena")
    expect(tidyHandle("instagram.com/@aling.nena")).toBe("aling.nena")
    expect(tidyHandle("  @aling_nena  ")).toBe("aling_nena")
  })

  it("refuses what would break the link it is pasted into", () => {
    expect(tidyHandle("")).toBeNull()
    expect(tidyHandle("aling nena")).toBeNull()
    expect(tidyHandle("a".repeat(31))).toBeNull()
    expect(tidyHandle("../../etc")).toBeNull()
    expect(tidyHandle("nena?x=1")).toBeNull()
  })
})

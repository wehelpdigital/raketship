import { describe, expect, it } from "vitest"

import { firstParam, safeNextPath, tidyNotice } from "@/features/auth/guards"

describe("safeNextPath", () => {
  it("keeps an ordinary in-app path", () => {
    expect(safeNextPath("/raket/abc")).toBe("/raket/abc")
    expect(safeNextPath("/dashboard?tab=modules")).toBe("/dashboard?tab=modules")
  })

  it("falls back when nothing usable arrives", () => {
    expect(safeNextPath(null)).toBe("/dashboard")
    expect(safeNextPath(undefined)).toBe("/dashboard")
    expect(safeNextPath("")).toBe("/dashboard")
    expect(safeNextPath("   ")).toBe("/dashboard")
  })

  it("refuses absolute URLs", () => {
    expect(safeNextPath("https://evil.example/steal")).toBe("/dashboard")
    expect(safeNextPath("javascript:alert(1)")).toBe("/dashboard")
  })

  it("refuses every protocol-relative disguise", () => {
    expect(safeNextPath("//evil.example")).toBe("/dashboard")
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard")
    expect(safeNextPath("/\t/evil.example")).toBe("/dashboard")
    expect(safeNextPath("/\n/evil.example")).toBe("/dashboard")
  })

  it("honours a caller-supplied fallback", () => {
    expect(safeNextPath("//evil.example", "/login")).toBe("/login")
  })
})

describe("firstParam", () => {
  it("unwraps a repeated query parameter", () => {
    expect(firstParam(["/a", "/b"])).toBe("/a")
    expect(firstParam("/a")).toBe("/a")
    expect(firstParam(undefined)).toBeUndefined()
  })
})

describe("tidyNotice", () => {
  it("collapses whitespace", () => {
    expect(tidyNotice("That link  \n expired.")).toBe("That link expired.")
  })

  it("drops an empty notice", () => {
    expect(tidyNotice(undefined)).toBeUndefined()
    expect(tidyNotice("   ")).toBeUndefined()
  })

  it("trims a crafted billboard down to size", () => {
    const long = tidyNotice("x".repeat(400))
    expect(long).toHaveLength(180)
    expect(long?.endsWith("…")).toBe(true)
  })
})

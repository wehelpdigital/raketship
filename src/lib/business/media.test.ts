import { describe, expect, it } from "vitest"

import { initialsOf, mediaPath, ownsMediaPath } from "./media"

const USER = "f79829df-9ee5-48bd-8948-bd5e627d7617"
const OTHER = "00000000-0000-4000-8000-000000000000"

describe("mediaPath", () => {
  it("files the image under its owner, which is what the bucket checks", () => {
    // The storage policy is (storage.foldername(name))[1] = auth.uid()::text,
    // so a name shaped any other way is refused by the bucket itself.
    expect(mediaPath(USER, "logo", "image/png", 1700)).toBe(
      `${USER}/logo-1700.png`
    )
  })

  it("normalises the jpeg extension people expect to see", () => {
    expect(mediaPath(USER, "cover", "image/jpeg", 1700)).toBe(
      `${USER}/cover-1700.jpg`
    )
  })

  it("keeps webp and avif as they are", () => {
    expect(mediaPath(USER, "logo", "image/webp", 1)).toBe(`${USER}/logo-1.webp`)
    expect(mediaPath(USER, "logo", "image/avif", 1)).toBe(`${USER}/logo-1.avif`)
  })

  it("falls back rather than producing a file with no extension", () => {
    expect(mediaPath(USER, "logo", "nonsense", 1)).toBe(`${USER}/logo-1.png`)
  })

  it("gives every upload its own name, so no CDN cache can serve the old one", () => {
    const first = mediaPath(USER, "logo", "image/png", 1000)
    const second = mediaPath(USER, "logo", "image/png", 2000)
    expect(first).not.toBe(second)
  })
})

describe("ownsMediaPath", () => {
  it("accepts a path in the user's own folder", () => {
    expect(ownsMediaPath(`${USER}/logo-1.png`, USER)).toBe(true)
  })

  it("refuses another user's folder", () => {
    // The browser names its own upload now, so this is the check that stops a
    // row pointing at a file its owner never uploaded.
    expect(ownsMediaPath(`${OTHER}/logo-1.png`, USER)).toBe(false)
  })

  it("refuses traversal dressed up as a folder name", () => {
    expect(ownsMediaPath(`${USER}/../${OTHER}/logo.png`, USER)).toBe(false)
    expect(ownsMediaPath(`../${USER}/logo.png`, USER)).toBe(false)
    expect(ownsMediaPath(`${USER}/..`, USER)).toBe(false)
  })

  it("refuses anything that is not exactly one folder and one file", () => {
    expect(ownsMediaPath(USER, USER).valueOf()).toBe(false)
    expect(ownsMediaPath(`${USER}/`, USER)).toBe(false)
    expect(ownsMediaPath(`${USER}/nested/logo.png`, USER)).toBe(false)
    expect(ownsMediaPath(`/${USER}/logo.png`, USER)).toBe(false)
    expect(ownsMediaPath(`${USER}//logo.png`, USER)).toBe(false)
  })

  it("refuses a prefix that merely starts with the id", () => {
    // "<uid>-evil/logo.png" starts with the uid as a STRING but is a different
    // folder, so a startsWith() check would have let it through.
    expect(ownsMediaPath(`${USER}-evil/logo.png`, USER)).toBe(false)
  })

  it("refuses empty, absurd and non-string input", () => {
    expect(ownsMediaPath("", USER)).toBe(false)
    expect(ownsMediaPath("x".repeat(400), USER)).toBe(false)
    expect(ownsMediaPath(null as unknown as string, USER)).toBe(false)
    expect(ownsMediaPath(undefined as unknown as string, USER)).toBe(false)
    expect(ownsMediaPath(123 as unknown as string, USER)).toBe(false)
  })

  it("accepts what mediaPath itself produces, for every type", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp", "image/avif"]) {
      for (const kind of ["logo", "cover"] as const) {
        expect(ownsMediaPath(mediaPath(USER, kind, type, 1700), USER)).toBe(true)
      }
    }
  })
})

describe("initialsOf", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsOf("Gupit ni Aling Nena")).toBe("GN")
    expect(initialsOf("Nena")).toBe("N")
  })

  it("falls back rather than rendering an empty circle", () => {
    expect(initialsOf(null)).toBe("R")
    expect(initialsOf("")).toBe("R")
    expect(initialsOf("   ")).toBe("R")
  })
})

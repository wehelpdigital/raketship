import { describe, expect, it } from "vitest"

import {
  IMAGE_ACCEPT,
  IMAGE_TYPES,
  initialsOf,
  isUnrenderablePhoto,
  mediaPath,
  normaliseImageType,
  ownsMediaPath,
} from "./media"

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

describe("normaliseImageType", () => {
  it("passes the canonical types through untouched", () => {
    for (const type of IMAGE_TYPES) {
      expect(normaliseImageType("photo.bin", type)).toBe(type)
    }
  })

  it("accepts the jpg spellings that are not image/jpeg", () => {
    // Measured against the live bucket: image/jpg and image/pjpeg were REFUSED
    // with a 400 while image/jpeg was accepted. A perfectly ordinary photo was
    // being turned away for how the operating system spelled it.
    expect(normaliseImageType("logo.jpg", "image/jpg")).toBe("image/jpeg")
    expect(normaliseImageType("logo.jpg", "image/pjpeg")).toBe("image/jpeg")
    expect(normaliseImageType("logo.png", "image/x-png")).toBe("image/png")
  })

  it("is not fooled by case or stray whitespace", () => {
    expect(normaliseImageType("logo.jpg", "IMAGE/JPEG")).toBe("image/jpeg")
    expect(normaliseImageType("logo.webp", " image/webp ")).toBe("image/webp")
  })

  it("falls back to the filename when the browser reports nothing", () => {
    // application/octet-stream was refused by the bucket too, and it is what
    // you get for a file that has been through a chat app.
    expect(normaliseImageType("logo.jpg", "")).toBe("image/jpeg")
    expect(normaliseImageType("logo.jpg", null)).toBe("image/jpeg")
    expect(normaliseImageType("logo.jpg", undefined)).toBe("image/jpeg")
    expect(normaliseImageType("logo.webp", "application/octet-stream")).toBe(
      "image/webp"
    )
    expect(normaliseImageType("SHOP LOGO.JPEG", "")).toBe("image/jpeg")
    expect(normaliseImageType("scan.jfif", "")).toBe("image/jpeg")
  })

  it("still refuses what genuinely is not one of these", () => {
    expect(normaliseImageType("notes.pdf", "application/pdf")).toBeNull()
    expect(normaliseImageType("clip.mp4", "video/mp4")).toBeNull()
    expect(normaliseImageType("old.gif", "image/gif")).toBeNull()
    expect(normaliseImageType("noextension", "")).toBeNull()
    expect(normaliseImageType("", "")).toBeNull()
  })

  it("never returns a type the bucket does not list", () => {
    // Anything it does return is uploaded verbatim as the content type, so a
    // value outside this set would be refused at the bucket.
    const inputs: [string, string | null][] = [
      ["a.jpg", "image/jpg"],
      ["a.jpeg", ""],
      ["a.png", "image/x-png"],
      ["a.webp", "application/octet-stream"],
      ["a.avif", "image/avif"],
      ["a.jfif", null],
    ]
    for (const [name, type] of inputs) {
      const result = normaliseImageType(name, type)
      expect(result, name).not.toBeNull()
      expect(IMAGE_TYPES).toContain(result)
    }
  })

  it("agrees with mediaPath about the extension", () => {
    const type = normaliseImageType("logo.jpg", "image/jpg")
    expect(type).toBe("image/jpeg")
    expect(mediaPath(USER, "logo", type!, 1)).toBe(USER + "/logo-1.jpg")
  })
})

describe("isUnrenderablePhoto", () => {
  it("knows an iPhone photo from a corrupt file", () => {
    // "Not an image" is a lie when the person is holding a photo, so this
    // earns its own message.
    expect(isUnrenderablePhoto("IMG_0001.HEIC", "image/heic")).toBe(true)
    expect(isUnrenderablePhoto("IMG_0001.heif", "")).toBe(true)
    expect(isUnrenderablePhoto("logo.jpg", "image/jpeg")).toBe(false)
    expect(isUnrenderablePhoto("notes.pdf", "application/pdf")).toBe(false)
  })
})

describe("IMAGE_ACCEPT", () => {
  it("offers extensions as well as types, so no picker greys out a jpg", () => {
    // Some platforms filter the file dialog by extension rather than by MIME.
    for (const part of [".jpg", ".jpeg", ".png", ".webp", ".avif"]) {
      expect(IMAGE_ACCEPT).toContain(part)
    }
    for (const type of IMAGE_TYPES) {
      expect(IMAGE_ACCEPT).toContain(type)
    }
  })
})

/**
 * Turning a stored object path into something an <img> can load.
 *
 * The row holds a PATH, not a URL, so the bucket can move or the project can
 * change domain without rewriting every row. The bucket is public, which is
 * why this can be built by string rather than signed: a signed URL expires,
 * and these images live inside links people paste into Facebook posts that
 * outlive any expiry we would pick.
 */

import { env } from "@/lib/env"

export const MEDIA_BUCKET = "business-media"

/** Mirrors the bucket's own file_size_limit. The bucket is the real guard. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/**
 * The types the bucket's allowed_mime_types actually lists. Exactly these
 * strings — Supabase matches them literally, so a near-miss is a rejection.
 */
export const IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
]

/**
 * What a file picker should offer.
 *
 * Extensions as well as MIME types, because some platforms filter the dialog
 * by extension and would otherwise grey out a perfectly good .jpg.
 */
export const IMAGE_ACCEPT = [
  ...IMAGE_TYPES,
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".avif",
].join(",")

/**
 * Spellings browsers actually send that are not the canonical type.
 *
 * `image/jpg` is not a registered media type but plenty of systems report it
 * for a .jpg, and `image/pjpeg` is a legacy Windows spelling. Both were
 * refused by the bucket — measured, not assumed — which meant a perfectly
 * ordinary photo was rejected for the way the OS spelled it.
 */
const TYPE_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
}

/** Canonical type -> the extension to store it under. */
const FILE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
}

/** Last resort when the browser reports nothing useful at all. */
const EXTENSION_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
}

/**
 * The canonical type for a chosen file, or null if it is not one we take.
 *
 * Two things go wrong without this. A browser may report `image/jpg`, which is
 * the same picture under a name the bucket does not list; or it may report
 * nothing at all — an empty string, or application/octet-stream — when the OS
 * cannot identify the file, which is common for anything that has been through
 * a chat app. Both were rejected as "not an image". The filename is the
 * fallback because by then it is the only evidence left.
 *
 * This is a courtesy, not a security control: the bucket re-checks the type it
 * is sent, and a caller who lies about it gets refused there.
 */
export function normaliseImageType(
  fileName: string,
  reportedType: string | null | undefined
): string | null {
  const reported = (reportedType ?? "").trim().toLowerCase()

  if (IMAGE_TYPES.includes(reported)) return reported
  if (reported in TYPE_ALIASES) return TYPE_ALIASES[reported]

  // Nothing usable was reported, so fall back to what the name says.
  const extension = fileName.toLowerCase().split(".").pop() ?? ""
  const fromName = EXTENSION_TYPES[extension]
  if (fromName) return fromName

  return null
}

/**
 * True for the formats a browser cannot render in an <img> even though a phone
 * happily produces them. Worth its own message: "not an image" is a lie, and
 * the person is holding a photo.
 */
export function isUnrenderablePhoto(
  fileName: string,
  reportedType: string | null | undefined
): boolean {
  const reported = (reportedType ?? "").toLowerCase()
  const extension = fileName.toLowerCase().split(".").pop() ?? ""
  return (
    reported.includes("heic") ||
    reported.includes("heif") ||
    extension === "heic" ||
    extension === "heif"
  )
}

/**
 * Where one user's image lives.
 *
 * The first path segment is the owner's id because the storage policy checks
 * exactly that — `(storage.foldername(name))[1] = auth.uid()::text` — so a
 * name built any other way is refused by the bucket itself.
 *
 * The timestamp busts the CDN cache. Overwriting one stable name would leave
 * the old picture showing on a public page for as long as it stayed cached.
 */
export function mediaPath(
  userId: string,
  kind: "logo" | "cover",
  mimeType: string,
  now: number
): string {
  // Takes a CANONICAL type — callers run normaliseImageType() first — so the
  // stored name always agrees with the content type the bucket was sent.
  const extension = FILE_EXTENSIONS[mimeType] ?? "png"
  return `${userId}/${kind}-${now}.${extension}`
}

/**
 * Whether a path is one this user is allowed to point their row at.
 *
 * The browser uploads its own file now, so it also names it — and a name
 * arriving from a browser is a claim, not a fact. Without this check someone
 * could point their row at another account's object. The bucket is public so
 * that leaks nothing, but a row should not be able to reference a file its
 * owner never uploaded.
 */
export function ownsMediaPath(path: string, userId: string): boolean {
  if (typeof path !== "string" || path.length === 0 || path.length > 300) {
    return false
  }
  // No traversal, no absolute paths, no empty segments.
  if (path.includes("..") || path.startsWith("/") || path.includes("//")) {
    return false
  }
  const segments = path.split("/")
  if (segments.length !== 2) return false
  return segments[0] === userId && segments[1].length > 0
}

/** Null when there is no image, or when Supabase is not configured. */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const base = env.supabaseUrl
  if (!base) return null
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`
}

/** "Gupit ni Aling Nena" -> "GA", for when there is no logo yet. */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "R"
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
}

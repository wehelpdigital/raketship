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
export const IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
]

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
  const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "png"
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

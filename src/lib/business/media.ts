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

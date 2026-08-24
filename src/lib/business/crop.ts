import type { CSSProperties } from "react"

/**
 * Where an image sits inside the shape it is cropped to.
 *
 * Serves both pictures: the logo's circle and the cover's 3:1 banner. Both
 * throw away most of a portrait photo taken on a phone, so both let the owner
 * say which part survives.
 *
 * One mechanism, not two. The image is `object-fit: cover`, so it always fills
 * the frame whatever its aspect ratio; `object-position` chooses which part of
 * it that is; and `transform: scale` magnifies from that same point because
 * `transform-origin` is pinned to it. Zooming therefore keeps whatever the
 * owner centred still centred, and no combination of the three can expose a
 * gap at the edge — cover fills it and the scale never drops below 1.
 *
 * An earlier sketch panned with a translate AND cropped with object-position,
 * which meant two crops fighting each other and offsets that had to be clamped
 * against the zoom to avoid gaps. This has no such invariant to get wrong.
 */

export interface ImageCrop {
  /** 1 to 4. Below 1 would shrink the image out of its own frame. */
  zoom: number
  /** 0-100, CSS object-position X. */
  x: number
  /** 0-100, CSS object-position Y. */
  y: number
}

export const DEFAULT_CROP: ImageCrop = { zoom: 1, x: 50, y: 50 }

export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value))

/**
 * Brings anything — a stored row, a drag in progress, a hand-edited number —
 * into range. Never throws and never returns NaN, because this feeds a style
 * attribute and a bad value there is an invisible broken page.
 */
export function normaliseCrop(input: Partial<ImageCrop> | null | undefined): ImageCrop {
  const zoom = Number(input?.zoom)
  const x = Number(input?.x)
  const y = Number(input?.y)

  return {
    zoom: Number.isFinite(zoom) ? clamp(round2(zoom), MIN_ZOOM, MAX_ZOOM) : 1,
    x: Number.isFinite(x) ? clamp(Math.round(x), 0, 100) : 50,
    y: Number.isFinite(y) ? clamp(Math.round(y), 0, 100) : 50,
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** The style for the <img> inside a cropping frame. */
export function cropStyle(crop: Partial<ImageCrop> | null | undefined): CSSProperties {
  const { zoom, x, y } = normaliseCrop(crop)
  return {
    objectFit: "cover",
    objectPosition: `${x}% ${y}%`,
    transform: zoom === 1 ? undefined : `scale(${zoom})`,
    transformOrigin: `${x}% ${y}%`,
  }
}

/** Whether the owner has moved this away from the default framing. */
export function isCropped(crop: Partial<ImageCrop> | null | undefined): boolean {
  const c = normaliseCrop(crop)
  return c.zoom !== 1 || c.x !== 50 || c.y !== 50
}

/**
 * A drag, in pixels across a frame of a given size, turned into new percentages.
 *
 * Dragging right should move the IMAGE right, which means showing more of its
 * left — so the object-position percentage goes DOWN. Getting that backwards
 * is the classic bug here and it feels broken instantly.
 *
 * Width and height are separate because the cover's frame is three times wider
 * than it is tall. Sharing one number would make a vertical drag across the
 * banner move the picture three times as far as a horizontal one.
 *
 * The travel is divided by the zoom because at 4x the same finger movement
 * should cover a quarter as much of the picture.
 */
export function dragCrop(
  start: ImageCrop,
  deltaX: number,
  deltaY: number,
  frameWidth: number,
  frameHeight: number = frameWidth
): ImageCrop {
  const from = normaliseCrop(start)
  const usable = (size: number) => Number.isFinite(size) && size > 0
  if (!usable(frameWidth) || !usable(frameHeight)) return from

  return normaliseCrop({
    zoom: from.zoom,
    x: from.x - deltaX * (100 / (frameWidth * from.zoom)),
    y: from.y - deltaY * (100 / (frameHeight * from.zoom)),
  })
}

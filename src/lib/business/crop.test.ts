import { describe, expect, it } from "vitest"

import {
  DEFAULT_CROP,
  dragCrop,
  isCropped,
  cropStyle,
  MAX_ZOOM,
  MIN_ZOOM,
  normaliseCrop,
} from "./crop"

describe("normaliseCrop", () => {
  it("keeps a sensible crop as it is", () => {
    expect(normaliseCrop({ zoom: 2, x: 30, y: 70 })).toEqual({
      zoom: 2,
      x: 30,
      y: 70,
    })
  })

  it("defaults to the middle at life size", () => {
    expect(normaliseCrop(null)).toEqual(DEFAULT_CROP)
    expect(normaliseCrop(undefined)).toEqual(DEFAULT_CROP)
    expect(normaliseCrop({})).toEqual(DEFAULT_CROP)
  })

  it("never lets the image shrink out of its own mask", () => {
    // Below 1 the image would stop covering the circle and leave a gap.
    expect(normaliseCrop({ zoom: 0.2, x: 50, y: 50 }).zoom).toBe(MIN_ZOOM)
    expect(normaliseCrop({ zoom: -5, x: 50, y: 50 }).zoom).toBe(MIN_ZOOM)
  })

  it("caps the zoom where a phone photo turns to mush", () => {
    expect(normaliseCrop({ zoom: 99, x: 50, y: 50 }).zoom).toBe(MAX_ZOOM)
  })

  it("holds the position inside the picture", () => {
    expect(normaliseCrop({ zoom: 1, x: -40, y: 140 })).toEqual({
      zoom: 1,
      x: 0,
      y: 100,
    })
  })

  it("refuses to emit NaN, which would silently break the style attribute", () => {
    const bad = normaliseCrop({
      zoom: Number.NaN,
      x: Number.POSITIVE_INFINITY,
      y: Number.NaN,
    })
    expect(bad).toEqual(DEFAULT_CROP)
    for (const value of Object.values(bad)) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it("survives junk out of the database", () => {
    const junk = { zoom: "2" as unknown as number, x: null as unknown as number }
    expect(() => normaliseCrop(junk)).not.toThrow()
    expect(normaliseCrop(junk).zoom).toBe(2)
  })
})

describe("cropStyle", () => {
  it("always covers the mask, so no crop can leave a gap", () => {
    // This is the invariant that makes the whole model safe: cover fills the
    // circle whatever the aspect ratio, and the zoom never drops below 1.
    for (const crop of [
      { zoom: 1, x: 0, y: 0 },
      { zoom: 4, x: 100, y: 100 },
      { zoom: 2.5, x: 13, y: 87 },
    ]) {
      expect(cropStyle(crop).objectFit).toBe("cover")
    }
  })

  it("anchors the zoom on the point that was chosen", () => {
    // If transform-origin did not track object-position, zooming would walk
    // away from whatever the owner had just centred.
    const style = cropStyle({ zoom: 3, x: 20, y: 80 })
    expect(style.objectPosition).toBe("20% 80%")
    expect(style.transformOrigin).toBe("20% 80%")
    expect(style.transform).toBe("scale(3)")
  })

  it("writes no transform at all when nothing is zoomed", () => {
    // A no-op transform still creates a compositing layer on some browsers.
    expect(cropStyle(DEFAULT_CROP).transform).toBeUndefined()
  })

  it("normalises before it renders", () => {
    const style = cropStyle({ zoom: 999, x: -20, y: 500 })
    expect(style.objectPosition).toBe("0% 100%")
    expect(style.transform).toBe(`scale(${MAX_ZOOM})`)
  })
})

describe("dragCrop", () => {
  const start = { zoom: 2, x: 50, y: 50 }

  it("moves the image WITH the finger, not against it", () => {
    // Dragging right shows more of the image's left, which is a LOWER
    // object-position. Getting this backwards feels broken on the first touch.
    const right = dragCrop(start, 40, 0, 200)
    expect(right.x).toBeLessThan(start.x)

    const left = dragCrop(start, -40, 0, 200)
    expect(left.x).toBeGreaterThan(start.x)

    const down = dragCrop(start, 0, 40, 200)
    expect(down.y).toBeLessThan(start.y)
  })

  it("covers less picture per pixel the further in you are zoomed", () => {
    const near = dragCrop({ zoom: 1, x: 50, y: 50 }, 40, 0, 200)
    const far = dragCrop({ zoom: 4, x: 50, y: 50 }, 40, 0, 200)
    // Same finger travel, a quarter of the movement at 4x.
    expect(Math.abs(50 - near.x)).toBeGreaterThan(Math.abs(50 - far.x))
  })

  it("stops at the edge instead of running off it", () => {
    expect(dragCrop(start, 100_000, 100_000, 200)).toEqual({
      zoom: 2,
      x: 0,
      y: 0,
    })
  })

  it("leaves the zoom alone", () => {
    expect(dragCrop(start, 25, 25, 200).zoom).toBe(2)
  })

  it("does nothing rather than dividing by zero before layout", () => {
    // A drag can fire before the element has been measured.
    expect(dragCrop(start, 30, 30, 0)).toEqual(normaliseCrop(start))
    expect(dragCrop(start, 30, 30, Number.NaN)).toEqual(normaliseCrop(start))
  })

  it("comes back to within a percent when dragged back", () => {
    // Not exactly: x and y are whole percentages, because the column is a
    // smallint and a hundredth of a logo is well under a pixel at any size it
    // renders at. So a round trip can land one percent out, and that is the
    // honest claim to make rather than an exact equality that would only pass
    // for deltas that happen to divide evenly.
    const moved = dragCrop(start, 30, -20, 200)
    const back = dragCrop(moved, -30, 20, 200)
    expect(Math.abs(back.x - start.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(back.y - start.y)).toBeLessThanOrEqual(1)
    expect(back.zoom).toBe(start.zoom)
  })
})

describe("isCropped", () => {
  it("knows an untouched logo from a framed one", () => {
    expect(isCropped(DEFAULT_CROP)).toBe(false)
    expect(isCropped(null)).toBe(false)
    expect(isCropped({ zoom: 1.5, x: 50, y: 50 })).toBe(true)
    expect(isCropped({ zoom: 1, x: 20, y: 50 })).toBe(true)
  })
})

describe("dragCrop across a frame that is not square", () => {
  const start = { zoom: 1, x: 50, y: 50 }

  it("moves the same distance for the same fraction of each side", () => {
    // The cover frame is 264x88. A drag of a quarter of the width and a
    // quarter of the height should shift the picture by the same amount on
    // each axis — sharing one number made a vertical drag move three times
    // as far as a horizontal one.
    const moved = dragCrop(start, 66, 22, 264, 88)
    expect(50 - moved.x).toBe(50 - moved.y)
  })

  it("still treats a square frame as square when only one size is given", () => {
    const both = dragCrop(start, 40, 40, 200, 200)
    const one = dragCrop(start, 40, 40, 200)
    expect(one).toEqual(both)
  })

  it("moves the picture with the finger on both axes", () => {
    const moved = dragCrop(start, 30, 20, 264, 88)
    expect(moved.x).toBeLessThan(50)
    expect(moved.y).toBeLessThan(50)
  })

  it("does nothing rather than dividing by zero on either axis", () => {
    expect(dragCrop(start, 30, 30, 264, 0)).toEqual(normaliseCrop(start))
    expect(dragCrop(start, 30, 30, 0, 88)).toEqual(normaliseCrop(start))
    expect(dragCrop(start, 30, 30, Number.NaN, 88)).toEqual(normaliseCrop(start))
  })
})

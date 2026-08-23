import { describe, expect, it } from "vitest"

import {
  CATEGORY_LABELS,
  NODE_TYPES,
  getNodeType,
  nodeTypesForScope,
  resolveNodeType,
  summarise,
  withDefaults,
} from "@/lib/flow/registry"

const ACCENTS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]

describe("NODE_TYPES", () => {
  it("has a unique type for every element", () => {
    const types = NODE_TYPES.map((def) => def.type)
    expect(new Set(types).size).toBe(types.length)
  })

  it("only uses accents that exist as design tokens", () => {
    for (const def of NODE_TYPES) {
      expect(ACCENTS, `${def.type} accent`).toContain(def.accent)
    }
  })

  it("gives every element a label, a short label and an icon", () => {
    for (const def of NODE_TYPES) {
      expect(def.label.length, `${def.type} label`).toBeGreaterThan(0)
      expect(def.short.length, `${def.type} short`).toBeGreaterThan(0)
      expect(def.short.length, `${def.type} short`).toBeLessThanOrEqual(12)
      expect(def.icon.length, `${def.type} icon`).toBeGreaterThan(0)
      expect(def.description.length, `${def.type} description`).toBeGreaterThan(0)
    }
  })

  it("gives every configurable element at least one field", () => {
    for (const def of NODE_TYPES) {
      expect(def.fields.length, `${def.type} fields`).toBeGreaterThan(0)
      for (const field of def.fields) {
        expect(field.key.length, `${def.type}.${field.key}`).toBeGreaterThan(0)
        expect(field.label.length, `${def.type}.${field.key}`).toBeGreaterThan(0)
      }
    }
  })

  it("gives every select field options, and defaults that match one", () => {
    for (const def of NODE_TYPES) {
      for (const field of def.fields) {
        if (field.type !== "select") continue
        expect(field.options.length, `${def.type}.${field.key}`).toBeGreaterThan(0)

        const fallback = def.defaults[field.key]
        if (fallback === undefined) continue
        expect(
          field.options.map((option) => option.value),
          `${def.type}.${field.key} default`
        ).toContain(fallback)
      }
    }
  })

  it("belongs to a known category", () => {
    for (const def of NODE_TYPES) {
      expect(Object.keys(CATEGORY_LABELS)).toContain(def.category)
    }
  })
})

describe("getNodeType / resolveNodeType", () => {
  it("finds a registered element", () => {
    expect(getNodeType("timer")?.label).toBe("Wait")
  })

  it("returns undefined for something unregistered", () => {
    expect(getNodeType("teleporter")).toBeUndefined()
  })

  it("falls back to a neutral descriptor rather than throwing", () => {
    const fallback = resolveNodeType("teleporter")
    expect(fallback.type).toBe("teleporter")
    expect(fallback.label).toBe("teleporter")
    expect(ACCENTS).toContain(fallback.accent)
  })
})

describe("nodeTypesForScope", () => {
  it("keeps the outer canvas to raket elements", () => {
    const types = nodeTypesForScope("raket").map((def) => def.type)
    expect(types).toContain("start")
    expect(types).toContain("module")
    expect(types).not.toContain("timer")
  })

  it("filters module elements down to one module", () => {
    const types = nodeTypesForScope("module", "booking")
    expect(types.length).toBeGreaterThan(0)
    for (const def of types) expect(def.moduleId).toBe("booking")
  })

  it("returns nothing for a module with no elements yet", () => {
    expect(nodeTypesForScope("module", "loyalty")).toEqual([])
  })
})

describe("withDefaults", () => {
  it("fills in the defaults when nothing is stored", () => {
    expect(withDefaults("timer")).toMatchObject({
      label: "Wait",
      delayValue: 1,
      delayUnit: "hours",
    })
  })

  it("lets stored values win over the defaults", () => {
    expect(withDefaults("timer", { delayValue: 48, delayUnit: "days" })).toMatchObject({
      label: "Wait",
      delayValue: 48,
      delayUnit: "days",
    })
  })

  it("keeps values the registry does not know about", () => {
    expect(withDefaults("timer", { note: "keep me" }).note).toBe("keep me")
  })

  it("returns an empty-ish object for an unknown element", () => {
    expect(withDefaults("teleporter", { label: "Zap" }).label).toBe("Zap")
  })
})

describe("summarise", () => {
  it("never throws, whatever the stored data looks like", () => {
    for (const def of NODE_TYPES) {
      expect(typeof summarise(def.type, {}), def.type).toBe("string")
      expect(summarise(def.type, {}).length, def.type).toBeGreaterThan(0)
      expect(
        typeof summarise(def.type, {
          delayValue: "not a number",
          service: 42,
          subject: null,
        }),
        def.type
      ).toBe("string")
    }
  })

  it("reads like plain language for a wait step", () => {
    expect(summarise("timer", { delayValue: 1, delayUnit: "hours" })).toBe(
      "Wait 1 hour after booking"
    )
    expect(
      summarise("timer", {
        delayValue: 2,
        delayUnit: "days",
        relativeTo: "appointment",
      })
    ).toBe("Wait 2 days before appointment")
  })

  it("describes a booking with its service and slot length", () => {
    expect(summarise("booking", { service: "Haircut", durationMinutes: 45 })).toBe(
      "Haircut · 45 min"
    )
  })

  it("stays useful for an unknown element", () => {
    expect(summarise("teleporter", {})).toBe("Tap to open the builder")
  })
})

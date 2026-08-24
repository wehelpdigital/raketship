import { describe, expect, it } from "vitest"

import {
  isModuleActive,
  moduleHref,
  moduleSubItems,
} from "./module-nav"
import { isNavItemActive } from "./bottom-nav"

const matcher = (pathname: string) => (href: string) =>
  isNavItemActive(pathname, href)

describe("moduleSubItems", () => {
  it("gives Booking its Booked page", () => {
    const children = moduleSubItems("booking")
    expect(children).toHaveLength(1)
    expect(children[0]).toMatchObject({
      id: "booked",
      name: "Booked",
      href: "/modules/booking/booked",
    })
  })

  it("gives nothing to a module without bespoke pages", () => {
    // The generic /modules/[moduleId] page has nothing to list.
    expect(moduleSubItems("crm")).toEqual([])
    expect(moduleSubItems("business")).toEqual([])
    expect(moduleSubItems("no-such-module")).toEqual([])
  })

  it("points at a real route under its parent", () => {
    for (const child of moduleSubItems("booking")) {
      expect(child.href.startsWith(`${moduleHref("booking")}/`)).toBe(true)
    }
  })
})

describe("isModuleActive", () => {
  it("lights the module up on its own page", () => {
    expect(isModuleActive("/modules/booking", "booking", matcher("/modules/booking"))).toBe(
      true
    )
  })

  it("stays lit on a page of its own that is not a listed child", () => {
    // A calendar editor is still "in" Booking.
    const path = "/modules/booking/8f14e45f-ceea-467a-9c4b-0dd0b0b0b0b0"
    expect(isModuleActive(path, "booking", matcher(path))).toBe(true)
  })

  it("hands the highlight to the child on the child's page", () => {
    // Without this, opening Booked lights up Booking as well and the
    // highlight stops meaning "you are here".
    const path = "/modules/booking/booked"
    expect(isModuleActive(path, "booking", matcher(path))).toBe(false)
    expect(isNavItemActive(path, "/modules/booking/booked")).toBe(true)
  })

  it("is not lit from somewhere else entirely", () => {
    expect(
      isModuleActive("/modules/business", "booking", matcher("/modules/business"))
    ).toBe(false)
    expect(isModuleActive("/dashboard", "booking", matcher("/dashboard"))).toBe(
      false
    )
  })

  it("is not fooled by a module whose id is a prefix of another", () => {
    // "/modules/book" must not match "/modules/booking".
    expect(isModuleActive("/modules/booking", "book", matcher("/modules/booking"))).toBe(
      false
    )
  })
})

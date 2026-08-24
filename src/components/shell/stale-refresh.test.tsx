import { render } from "@testing-library/react"
import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { StaleRefresh } from "./stale-refresh"

const refresh = vi.hoisted(() => vi.fn())
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}))

/** jsdom has no real visibility, so it is driven directly. */
function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  })
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-09-01T00:00:00.000Z"))
  setVisibility("visible")
})

afterEach(() => {
  vi.useRealTimers()
})

const advance = (ms: number) =>
  vi.setSystemTime(new Date(Date.now() + ms))

describe("StaleRefresh", () => {
  it("renders nothing", () => {
    const { container } = render(<StaleRefresh />)
    expect(container).toBeEmptyDOMElement()
  })

  it("does nothing while the tab is just sitting there", () => {
    render(<StaleRefresh />)
    expect(refresh).not.toHaveBeenCalled()
  })

  it("refetches when the tab is looked at again after a while", () => {
    // The case this exists for: a booking arrived in someone else's browser,
    // so nothing here could have been told about it.
    render(<StaleRefresh />)

    setVisibility("hidden")
    advance(30_000)
    setVisibility("visible")

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("ignores a quick flick to another window", () => {
    // Alt-tabbing to copy a phone number should not cost a round trip.
    render(<StaleRefresh />)

    setVisibility("hidden")
    advance(1000)
    setVisibility("visible")

    expect(refresh).not.toHaveBeenCalled()
  })

  it("honours a caller that wants a different threshold", () => {
    render(<StaleRefresh minHiddenMs={500} />)

    setVisibility("hidden")
    advance(800)
    setVisibility("visible")

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("does not refetch twice for one absence", () => {
    render(<StaleRefresh />)

    setVisibility("hidden")
    advance(30_000)
    setVisibility("visible")
    setVisibility("visible")

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("stops listening once it is gone", () => {
    const { unmount } = render(<StaleRefresh />)
    unmount()

    setVisibility("hidden")
    advance(30_000)
    setVisibility("visible")

    expect(refresh).not.toHaveBeenCalled()
  })
})

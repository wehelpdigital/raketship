import { describe, expect, it } from "vitest"

import {
  CANCEL_NOTICES,
  cancelNoticeLabel,
  cancelNoticeSentence,
  hoursLabel,
} from "./notice"

describe("hoursLabel", () => {
  it("counts in hours below a day", () => {
    expect(hoursLabel(1)).toBe("1 oras")
    expect(hoursLabel(2)).toBe("2 oras")
    expect(hoursLabel(12)).toBe("12 oras")
    expect(hoursLabel(23)).toBe("23 oras")
  })

  it("counts in days from a day up", () => {
    expect(hoursLabel(24)).toBe("1 araw")
    expect(hoursLabel(48)).toBe("2 araw")
    expect(hoursLabel(72)).toBe("3 araw")
  })

  it("says weeks when that is what somebody would say", () => {
    expect(hoursLabel(168)).toBe("1 linggo")
    expect(hoursLabel(336)).toBe("2 linggo")
  })

  it("never emits a number nobody chose", () => {
    expect(hoursLabel(0)).toBe("kahit kailan")
    expect(hoursLabel(-5)).toBe("kahit kailan")
  })
})

describe("cancelNoticeLabel", () => {
  it("says plainly when there is no deadline", () => {
    expect(cancelNoticeLabel(0)).toBe("No deadline")
  })

  it("reads as a deadline, not a duration", () => {
    // "24 hours" could be a length; "1 day before" cannot be misread.
    expect(cancelNoticeLabel(1)).toBe("1 hour before")
    expect(cancelNoticeLabel(4)).toBe("4 hours before")
    expect(cancelNoticeLabel(24)).toBe("1 day before")
    expect(cancelNoticeLabel(48)).toBe("2 days before")
    expect(cancelNoticeLabel(168)).toBe("1 week before")
  })

  it("labels every preset without falling through to a blank", () => {
    for (const hours of CANCEL_NOTICES) {
      expect(cancelNoticeLabel(hours).length).toBeGreaterThan(0)
    }
  })
})

describe("cancelNoticeSentence", () => {
  it("asks for the notice the owner set", () => {
    expect(cancelNoticeSentence(24)).toContain("1 araw")
    expect(cancelNoticeSentence(24)).toContain("hindi bababa sa")
    expect(cancelNoticeSentence(2)).toContain("2 oras")
  })

  it("asks nothing in particular when there is no deadline", () => {
    // "at least 0 hours before" is both nonsense and slightly rude.
    const sentence = cancelNoticeSentence(0)
    expect(sentence).toBe("Mag-message lang po sa amin.")
    expect(sentence).not.toContain("0")
    expect(sentence).not.toContain("hindi bababa")
  })

  it("never says zero however it is asked", () => {
    for (const hours of [0, -1, -100, 0.2]) {
      expect(cancelNoticeSentence(hours)).not.toContain("bababa")
    }
  })

  it("rounds a fraction rather than printing one", () => {
    expect(cancelNoticeSentence(1.6)).toContain("2 oras")
  })

  it("reads as a request, not a threat — nothing enforces it", () => {
    // A public booking has no account behind it, so the page can only ask.
    expect(cancelNoticeSentence(24).toLowerCase()).toContain("paki")
  })

  it("says something for every preset", () => {
    for (const hours of CANCEL_NOTICES) {
      expect(cancelNoticeSentence(hours).length).toBeGreaterThan(10)
    }
  })
})

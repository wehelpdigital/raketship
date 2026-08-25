import { describe, expect, it } from "vitest"

import { tagalogCount, tagalogLinker, tagalogNumber } from "./numbers"

describe("tagalogNumber", () => {
  it("counts to ten", () => {
    const words = [
      "isa",
      "dalawa",
      "tatlo",
      "apat",
      "lima",
      "anim",
      "pito",
      "walo",
      "siyam",
      "sampu",
    ]
    words.forEach((word, index) => {
      expect(tagalogNumber(index + 1)).toBe(word)
    })
  })

  it("counts through the teens", () => {
    expect(tagalogNumber(11)).toBe("labing-isa")
    expect(tagalogNumber(13)).toBe("labintatlo")
    expect(tagalogNumber(15)).toBe("labinlima")
    expect(tagalogNumber(17)).toBe("labimpito")
    expect(tagalogNumber(19)).toBe("labinsiyam")
  })

  it("joins tens and ones with 't", () => {
    expect(tagalogNumber(20)).toBe("dalawampu")
    expect(tagalogNumber(21)).toBe("dalawampu't isa")
    expect(tagalogNumber(29)).toBe("dalawampu't siyam")
    expect(tagalogNumber(30)).toBe("tatlumpu")
  })

  it("gives back the digits rather than inventing a word", () => {
    // A wrong number word is worse than a digit.
    expect(tagalogNumber(0)).toBe("0")
    expect(tagalogNumber(-3)).toBe("-3")
    expect(tagalogNumber(1.5)).toBe("1.5")
    expect(tagalogNumber(1000)).toBe("1000")
  })
})

describe("tagalogLinker", () => {
  it("uses -ng after a vowel", () => {
    expect(tagalogLinker("tatlo")).toBe("tatlong")
    expect(tagalogLinker("lima")).toBe("limang")
    expect(tagalogLinker("sampu")).toBe("sampung")
  })

  it("uses na after any other consonant", () => {
    // "apatng araw" is not a word; "apat na araw" is.
    expect(tagalogLinker("apat")).toBe("apat na")
    expect(tagalogLinker("anim")).toBe("anim na")
    expect(tagalogLinker("siyam")).toBe("siyam na")
  })

  it("uses -g after n", () => {
    expect(tagalogLinker("gabun")).toBe("gabung")
  })
})

describe("tagalogCount", () => {
  it("is ready to be followed by the thing it counts", () => {
    expect(`${tagalogCount(3)} araw`).toBe("tatlong araw")
    expect(`${tagalogCount(4)} araw`).toBe("apat na araw")
    expect(`${tagalogCount(6)} araw`).toBe("anim na araw")
    expect(`${tagalogCount(10)} araw`).toBe("sampung araw")
    expect(`${tagalogCount(21)} araw`).toBe("dalawampu't isang araw")
  })

  it("links every number it can spell", () => {
    for (let n = 1; n <= 30; n++) {
      const counted = tagalogCount(n)
      expect(counted.length).toBeGreaterThan(0)
      // Either the linker is stuck on the end, or it is the separate "na".
      expect(/(ng|g)$|\sna$/.test(counted)).toBe(true)
    }
  })

  it("goes on spelling past thirty", () => {
    expect(`${tagalogCount(45)} araw`).toBe("apatnapu't limang araw")
    expect(`${tagalogCount(90)} araw`).toBe("siyamnapung araw")
  })

  it("still links a number it has no word for", () => {
    // Past ninety-nine it hands back digits rather than guessing, and digits
    // take the separate linker.
    expect(`${tagalogCount(150)} araw`).toBe("150 na araw")
  })
})

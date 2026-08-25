/**
 * Counting things in Tagalog.
 *
 * "Sa loob ng 3 araw" is how a form reads; "sa loob ng tatlong araw" is how a
 * person says it. Small numbers are spelled out for the same reason English
 * spells "three days" and not "3 days" in a sentence.
 *
 * The linker is the part that is easy to get wrong. A counted noun takes a
 * linker on the number, and which one depends on the last sound:
 *
 *   ends in a vowel   ->  -ng      tatlo   -> tatlong araw
 *   ends in n         ->  -g       (none in 1..30, kept for correctness)
 *   anything else     ->  na       apat    -> apat na araw
 *
 * Getting that wrong is not a typo, it is a foreign accent — "apat na araw" is
 * right and "apatng araw" is not a word.
 */

const ONES = [
  "",
  "isa",
  "dalawa",
  "tatlo",
  "apat",
  "lima",
  "anim",
  "pito",
  "walo",
  "siyam",
] as const

const TEENS = [
  "sampu",
  "labing-isa",
  "labindalawa",
  "labintatlo",
  "labing-apat",
  "labinlima",
  "labing-anim",
  "labimpito",
  "labingwalo",
  "labinsiyam",
] as const

const TENS: Record<number, string> = {
  20: "dalawampu",
  30: "tatlumpu",
  40: "apatnapu",
  50: "limampu",
  60: "animnapu",
  70: "pitumpu",
  80: "walumpu",
  90: "siyamnapu",
}

const VOWELS = "aeiou"

/**
 * The number as a Tagalog word, without a linker.
 *
 * Falls back to the digits above what it knows rather than inventing a word —
 * a wrong number word is worse than a digit, and the callers here never count
 * past thirty.
 */
export function tagalogNumber(n: number): string {
  if (!Number.isInteger(n) || n < 1) return String(n)
  if (n < 10) return ONES[n]
  if (n < 20) return TEENS[n - 10]

  const tens = Math.floor(n / 10) * 10
  const ones = n % 10
  const tensWord = TENS[tens]
  if (!tensWord) return String(n)
  if (ones === 0) return tensWord
  return `${tensWord}'t ${ONES[ones]}`
}

/** The linker a word takes when it counts a noun. */
export function tagalogLinker(word: string): string {
  const last = word.slice(-1).toLowerCase()
  if (VOWELS.includes(last)) return `${word}ng`
  if (last === "n") return `${word}g`
  return `${word} na`
}

/**
 * "tatlong", "apat na", "labinlimang" — ready to be followed by the thing
 * being counted.
 *
 * Numbers past what tagalogNumber knows come back as digits, and digits take
 * the "na" linker: "45 na araw" is how it is written down.
 */
export function tagalogCount(n: number): string {
  return tagalogLinker(tagalogNumber(n))
}

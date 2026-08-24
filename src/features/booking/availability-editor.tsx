"use client"

/**
 * When the calendar is open, and when it is not.
 *
 * Three decisions live on this screen: the weekly hours, the place those hours
 * belong to (country + timezone), and the specific dates that override the
 * week. They are edited together because they only make sense together — "9 to
 * 5" means nothing until you say where, and a Tuesday rule means nothing on the
 * Tuesday you are at a wedding.
 *
 * Hours are held as "HH:MM" strings while being edited, because that is what
 * <input type="time"> speaks, and converted to minutes-from-midnight only at
 * the boundary — see rulesFromRows(). Everything above the component is pure
 * and exported so the awkward parts (overlap, end-before-start, the round trip)
 * can be tested without rendering a thing.
 */

import * as React from "react"
import {
  CalendarOff,
  Check,
  Clock3,
  Copy,
  Globe2,
  LoaderCircle,
  Plus,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  type BookingActionResult,
  addBlackout,
  removeBlackout,
  setAvailability,
  updateCalendar,
} from "@/features/booking/actions"
import {
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  formatTimeLabel,
  isoDateInZone,
  minutesToTime,
  timeToMinutes,
  zoneOffsetMinutes,
} from "@/lib/booking/slots"
import type {
  BookingAvailabilityRow,
  BookingBlackoutRow,
  BookingCalendarRow,
} from "@/lib/supabase/types"
import { useNowTick } from "@/lib/hooks/client"
import { cn } from "@/lib/utils"

// =============================================================================
// Row state
// =============================================================================

/** One start–end pair while it is being edited. `id` is a React key, nothing more. */
export interface HourRange {
  id: string
  /** "09:00" — exactly what <input type="time"> hands back. */
  start: string
  end: string
}

export interface DayRow {
  /** 0 = Sunday, matching WEEKDAY_LABELS and the database. */
  weekday: number
  enabled: boolean
  ranges: HourRange[]
}

/** The shape the server action wants back. */
export interface AvailabilityRule {
  weekday: number
  startMinute: number
  endMinute: number
}

export type SavedRule = Pick<
  BookingAvailabilityRow,
  "weekday" | "start_minute" | "end_minute"
>

export const DEFAULT_START = "09:00"
export const DEFAULT_END = "17:00"

let rangeSeq = 0

/** A range with a fresh key. Not pure by design — the id is display-only. */
export function makeRange(start: string, end: string): HourRange {
  rangeSeq += 1
  return { id: `range-${rangeSeq}`, start, end }
}

function parseRange(range: HourRange): { start: number; end: number } | null {
  const start = timeToMinutes(range.start)
  const end = timeToMinutes(range.end)
  if (start === null || end === null) return null
  return { start, end }
}

/** Seven rows, Sunday first. Days with no saved rule keep a sensible default. */
export function rowsFromAvailability(availability: SavedRule[]): DayRow[] {
  const byDay = new Map<number, HourRange[]>()

  for (const rule of [...availability].sort(
    (a, b) => a.weekday - b.weekday || a.start_minute - b.start_minute
  )) {
    if (rule.weekday < 0 || rule.weekday > 6) continue
    if (rule.end_minute <= rule.start_minute) continue
    const list = byDay.get(rule.weekday) ?? []
    list.push(
      makeRange(minutesToTime(rule.start_minute), minutesToTime(rule.end_minute))
    )
    byDay.set(rule.weekday, list)
  }

  return WEEKDAY_LABELS.map((_, weekday) => {
    const ranges = byDay.get(weekday) ?? []
    return {
      weekday,
      enabled: ranges.length > 0,
      // A closed day still carries one range so switching it on shows something.
      ranges: ranges.length > 0 ? ranges : [makeRange(DEFAULT_START, DEFAULT_END)],
    }
  })
}

/** Rows → what the server stores. Invalid ranges are dropped, never sent. */
export function rulesFromRows(rows: DayRow[]): AvailabilityRule[] {
  const rules: AvailabilityRule[] = []

  for (const row of rows) {
    if (!row.enabled) continue
    for (const range of row.ranges) {
      const parsed = parseRange(range)
      if (!parsed) continue
      if (parsed.end <= parsed.start) continue
      rules.push({
        weekday: row.weekday,
        startMinute: parsed.start,
        endMinute: parsed.end,
      })
    }
  }

  return rules.sort(
    (a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute
  )
}

/** Saved rows in the same shape, so the two can be compared. */
export function rulesFromAvailability(availability: SavedRule[]): AvailabilityRule[] {
  return availability
    .filter((a) => a.end_minute > a.start_minute)
    .map((a) => ({
      weekday: a.weekday,
      startMinute: a.start_minute,
      endMinute: a.end_minute,
    }))
    .sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute)
}

/** A stable string for a rule set — used only to spot unsaved changes. */
export function signatureOf(rules: AvailabilityRule[]): string {
  return rules
    .map((r) => `${r.weekday}:${r.startMinute}-${r.endMinute}`)
    .join("|")
}

// =============================================================================
// Validation — nothing broken reaches the server
// =============================================================================

/** Why one range is unusable, or null when it is fine. */
export function rangeError(range: HourRange): string | null {
  if (!range.start.trim() || !range.end.trim()) {
    return "Add both a start and an end time."
  }
  const parsed = parseRange(range)
  if (!parsed) return "That time does not look right — use the picker."
  if (parsed.end === parsed.start) return "Start and end are the same time."
  if (parsed.end < parsed.start) return "The end time has to be after the start."
  return null
}

/** True when two ranges share any minute. Touching ends (12:00/12:00) do not. */
export function rangesOverlap(a: HourRange, b: HourRange): boolean {
  const first = parseRange(a)
  const second = parseRange(b)
  if (!first || !second) return false
  return first.start < second.end && second.start < first.end
}

/** The one thing wrong with a day, in the order a person would notice it. */
export function dayError(row: DayRow): string | null {
  if (!row.enabled) return null
  if (row.ranges.length === 0) {
    return "Add a time range, or switch the day off."
  }

  for (const range of row.ranges) {
    const problem = rangeError(range)
    if (problem) return problem
  }

  const sorted = row.ranges
    .map(parseRange)
    .filter((value): value is { start: number; end: number } => value !== null)
    .sort((a, b) => a.start - b.start)

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1]
    const current = sorted[i]
    if (current.start < previous.end) {
      return `${formatTimeLabel(previous.start)}–${formatTimeLabel(
        previous.end
      )} overlaps ${formatTimeLabel(current.start)}–${formatTimeLabel(
        current.end
      )}.`
    }
  }

  return null
}

/** Weekday → message, for every day that has a problem. */
export function collectErrors(rows: DayRow[]): Record<number, string> {
  const errors: Record<number, string> = {}
  for (const row of rows) {
    const problem = dayError(row)
    if (problem) errors[row.weekday] = problem
  }
  return errors
}

// =============================================================================
// Row edits
// =============================================================================

/** The next range to offer, an hour after the last one ends. Null when no room. */
export function suggestNextRange(ranges: HourRange[]): HourRange | null {
  const parsed = ranges
    .map(parseRange)
    .filter((value): value is { start: number; end: number } => value !== null)
    .sort((a, b) => a.start - b.start)

  const last = parsed[parsed.length - 1]
  if (!last) return makeRange(DEFAULT_START, DEFAULT_END)

  const start = last.end + 60
  // 23:59 is the latest an <input type="time"> can hold, so a suggestion of
  // "24:00" would land in the picker as a blank box.
  const end = Math.min(start + 120, 1439)
  if (start >= 1439 || end <= start) return null

  return makeRange(minutesToTime(start), minutesToTime(end))
}

/**
 * Monday's hours onto Tuesday–Friday. Filling seven rows by hand on a phone is
 * the most tedious minute of setting a calendar up, and most shops keep one
 * weekday pattern anyway.
 */
export function copyMondayToWeekdays(rows: DayRow[]): DayRow[] {
  const monday = rows.find((row) => row.weekday === 1)
  if (!monday) return rows

  return rows.map((row) =>
    row.weekday >= 2 && row.weekday <= 5
      ? {
          weekday: row.weekday,
          enabled: monday.enabled,
          ranges: monday.ranges.map((range) => makeRange(range.start, range.end)),
        }
      : row
  )
}

/** Mon–Fri, nine to five, weekend closed. The most common shape by far. */
export function weekdayPreset(): DayRow[] {
  return WEEKDAY_LABELS.map((_, weekday) => {
    const open = weekday >= 1 && weekday <= 5
    return {
      weekday,
      enabled: open,
      ranges: [makeRange(DEFAULT_START, DEFAULT_END)],
    }
  })
}

/** Total open minutes across the week, ignoring anything invalid. */
export function weeklyOpenMinutes(rows: DayRow[]): number {
  return rulesFromRows(rows).reduce(
    (total, rule) => total + (rule.endMinute - rule.startMinute),
    0
  )
}

/** 2310 → "38.5 hours". */
export function formatOpenHours(minutes: number): string {
  if (minutes <= 0) return "No hours yet"
  const hours = minutes / 60
  const rounded = Math.round(hours * 10) / 10
  return `${rounded} ${rounded === 1 ? "hour" : "hours"} open each week`
}

/** One day's ranges as a line: "9:00 AM–12:00 PM · 1:00 PM–5:00 PM". */
export function summariseDay(row: DayRow): string {
  if (!row.enabled) return "Closed"
  const parts = row.ranges
    .map(parseRange)
    .filter((value): value is { start: number; end: number } => value !== null)
    .sort((a, b) => a.start - b.start)
    .map((r) => `${formatTimeLabel(r.start)}–${formatTimeLabel(r.end)}`)
  return parts.length > 0 ? parts.join(" · ") : "Set the hours"
}

// =============================================================================
// Country and timezone
// =============================================================================

export const DEFAULT_TIMEZONE = "Asia/Manila"
export const DEFAULT_COUNTRY = "PH"

/**
 * Intl.supportedValuesOf is missing from older runtimes and from some test
 * environments, so the shortlist below is the floor, never the whole list.
 */
export const FALLBACK_TIMEZONES = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
]

function readSupportedTimezones(): string[] {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      const zones = Intl.supportedValuesOf("timeZone")
      if (Array.isArray(zones) && zones.length > 0) return zones
    }
  } catch {
    // Older runtime, or a locked-down one. The fallback below is enough.
  }
  return []
}

export const ALL_TIMEZONES: string[] = Array.from(
  new Set([...readSupportedTimezones(), ...FALLBACK_TIMEZONES])
).sort((a, b) => a.localeCompare(b))

export interface CountryOption {
  code: string
  name: string
  /** Most-used zones first; the first one is what picking the country suggests. */
  zones: string[]
}

/** Nearby first — that is where nearly every RaketShip user actually is. */
export const NEARBY_COUNTRIES: CountryOption[] = [
  { code: "PH", name: "Philippines", zones: ["Asia/Manila"] },
  { code: "SG", name: "Singapore", zones: ["Asia/Singapore"] },
  { code: "MY", name: "Malaysia", zones: ["Asia/Kuala_Lumpur"] },
  { code: "ID", name: "Indonesia", zones: ["Asia/Jakarta", "Asia/Makassar"] },
  { code: "TH", name: "Thailand", zones: ["Asia/Bangkok"] },
  { code: "VN", name: "Vietnam", zones: ["Asia/Ho_Chi_Minh"] },
  { code: "HK", name: "Hong Kong", zones: ["Asia/Hong_Kong"] },
  { code: "TW", name: "Taiwan", zones: ["Asia/Taipei"] },
  { code: "JP", name: "Japan", zones: ["Asia/Tokyo"] },
  { code: "KR", name: "South Korea", zones: ["Asia/Seoul"] },
  { code: "AU", name: "Australia", zones: ["Australia/Sydney", "Australia/Perth"] },
  { code: "NZ", name: "New Zealand", zones: ["Pacific/Auckland"] },
]

export const OTHER_COUNTRIES: CountryOption[] = [
  { code: "AE", name: "United Arab Emirates", zones: ["Asia/Dubai"] },
  { code: "AR", name: "Argentina", zones: ["America/Argentina/Buenos_Aires"] },
  { code: "BH", name: "Bahrain", zones: ["Asia/Bahrain"] },
  { code: "BR", name: "Brazil", zones: ["America/Sao_Paulo"] },
  { code: "CA", name: "Canada", zones: ["America/Toronto", "America/Vancouver"] },
  { code: "CH", name: "Switzerland", zones: ["Europe/Zurich"] },
  { code: "CN", name: "China", zones: ["Asia/Shanghai"] },
  { code: "DE", name: "Germany", zones: ["Europe/Berlin"] },
  { code: "DK", name: "Denmark", zones: ["Europe/Copenhagen"] },
  { code: "EG", name: "Egypt", zones: ["Africa/Cairo"] },
  { code: "ES", name: "Spain", zones: ["Europe/Madrid"] },
  { code: "FR", name: "France", zones: ["Europe/Paris"] },
  { code: "GB", name: "United Kingdom", zones: ["Europe/London"] },
  { code: "IE", name: "Ireland", zones: ["Europe/Dublin"] },
  { code: "IL", name: "Israel", zones: ["Asia/Jerusalem"] },
  { code: "IN", name: "India", zones: ["Asia/Kolkata"] },
  { code: "IT", name: "Italy", zones: ["Europe/Rome"] },
  { code: "KE", name: "Kenya", zones: ["Africa/Nairobi"] },
  { code: "KW", name: "Kuwait", zones: ["Asia/Kuwait"] },
  { code: "MX", name: "Mexico", zones: ["America/Mexico_City"] },
  { code: "NG", name: "Nigeria", zones: ["Africa/Lagos"] },
  { code: "NL", name: "Netherlands", zones: ["Europe/Amsterdam"] },
  { code: "NO", name: "Norway", zones: ["Europe/Oslo"] },
  { code: "OM", name: "Oman", zones: ["Asia/Muscat"] },
  { code: "PT", name: "Portugal", zones: ["Europe/Lisbon"] },
  { code: "QA", name: "Qatar", zones: ["Asia/Qatar"] },
  { code: "SA", name: "Saudi Arabia", zones: ["Asia/Riyadh"] },
  { code: "SE", name: "Sweden", zones: ["Europe/Stockholm"] },
  { code: "US", name: "United States", zones: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"] },
  { code: "ZA", name: "South Africa", zones: ["Africa/Johannesburg"] },
].sort((a, b) => a.name.localeCompare(b.name))

export const COUNTRIES: CountryOption[] = [...NEARBY_COUNTRIES, ...OTHER_COUNTRIES]

export function findCountry(code: string): CountryOption | null {
  return COUNTRIES.find((entry) => entry.code === code) ?? null
}

/** "Asia/Manila" → "Manila". "America/Argentina/Buenos_Aires" → "Buenos Aires, Argentina". */
export function zoneLabel(zone: string): string {
  const parts = zone.split("/")
  if (parts.length <= 1) return zone.replace(/_/g, " ")
  return parts.slice(1).reverse().join(", ").replace(/_/g, " ")
}

/** "Asia/Manila" → "Asia". Zones with no area land in "Other". */
export function zoneArea(zone: string): string {
  const index = zone.indexOf("/")
  return index === -1 ? "Other" : zone.slice(0, index).replace(/_/g, " ")
}

/** 480 → "GMT+8". 330 → "GMT+5:30". */
export function gmtLabel(offsetMinutes: number): string {
  if (offsetMinutes === 0) return "GMT"
  const sign = offsetMinutes > 0 ? "+" : "-"
  const absolute = Math.abs(offsetMinutes)
  const hours = Math.floor(absolute / 60)
  const minutes = absolute % 60
  return minutes === 0
    ? `GMT${sign}${hours}`
    : `GMT${sign}${hours}:${String(minutes).padStart(2, "0")}`
}

/** The handful worth showing above the full list: this zone, this country, home. */
export function suggestedZones(country: string, current: string): string[] {
  const entry = findCountry(country)
  const list = [current, ...(entry?.zones ?? []), DEFAULT_TIMEZONE, "UTC"]
  return Array.from(new Set(list.filter((zone) => zone.length > 0)))
}

const TIMEZONE_ITEMS = ALL_TIMEZONES.map((zone) => ({
  label: zoneLabel(zone),
  value: zone,
}))

const TIMEZONE_AREAS: { area: string; zones: string[] }[] = (() => {
  const byArea = new Map<string, string[]>()
  for (const zone of ALL_TIMEZONES) {
    const area = zoneArea(zone)
    const list = byArea.get(area) ?? []
    list.push(zone)
    byArea.set(area, list)
  }
  return [...byArea.entries()]
    .map(([area, zones]) => ({ area, zones }))
    .sort((a, b) => a.area.localeCompare(b.area))
})()

const COUNTRY_ITEMS = COUNTRIES.map((entry) => ({
  label: entry.name,
  value: entry.code,
}))

/**
 * ICU 72 and later separate "4:32" from "PM" with a narrow no-break space.
 * Flattening it keeps the label copy-pasteable and the output the same
 * whatever tzdata the runtime shipped with.
 */
function plainSpaces(value: string): string {
  return value.replace(/[\u202f\u00a0]/g, " ")
}

/** The wall clock in a zone, or null when the runtime rejects the zone. */
export function timeInZone(date: Date, timeZone: string): string | null {
  try {
    return plainSpaces(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(date)
    )
  } catch {
    return null
  }
}

/** "Monday, 24 Aug" in a zone. */
export function dayInZone(date: Date, timeZone: string): string | null {
  try {
    return plainSpaces(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "long",
        day: "numeric",
        month: "short",
      }).format(date)
    )
  } catch {
    return null
  }
}

// =============================================================================
// Blackout dates
// =============================================================================

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

/** True for a real calendar date in "YYYY-MM-DD" form. */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const probe = new Date(Date.UTC(year, month - 1, day))
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  )
}

export function hasBlackout(
  blackouts: Pick<BookingBlackoutRow, "date">[],
  date: string
): boolean {
  return blackouts.some((entry) => entry.date === date)
}

/** "2026-08-24" → "Mon 24". Read off a UTC date so it never drifts by a day. */
export function formatIsoDay(iso: string): string {
  if (!isValidIsoDate(iso)) return iso
  const [year, month, day] = iso.split("-").map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return `${WEEKDAY_SHORT[weekday]} ${day}`
}

/** "2026-08-24" → "Monday, 24 August 2026". */
export function formatIsoLong(iso: string): string {
  if (!isValidIsoDate(iso)) return iso
  const [year, month, day] = iso.split("-").map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return `${WEEKDAY_LABELS[weekday]}, ${day} ${MONTH_NAMES[month - 1]} ${year}`
}

export interface BlackoutMonth {
  /** "2026-08" */
  key: string
  label: string
  items: { row: BookingBlackoutRow; isPast: boolean }[]
}

/**
 * Blackouts grouped by month, ascending, with past dates flagged so they can be
 * shown quietly rather than hidden — people do look back to check what happened.
 */
export function groupBlackoutsByMonth(
  blackouts: BookingBlackoutRow[],
  todayIso: string | null
): BlackoutMonth[] {
  const byMonth = new Map<string, { row: BookingBlackoutRow; isPast: boolean }[]>()

  for (const row of [...blackouts].sort((a, b) => a.date.localeCompare(b.date))) {
    const key = row.date.slice(0, 7)
    const list = byMonth.get(key) ?? []
    list.push({ row, isPast: todayIso !== null && row.date < todayIso })
    byMonth.set(key, list)
  }

  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, items]) => {
      const [year, month] = key.split("-").map(Number)
      const label = MONTH_NAMES[month - 1]
        ? `${MONTH_NAMES[month - 1]} ${year}`
        : key
      return { key, label, items }
    })
}

// =============================================================================
// Server action results
// =============================================================================

interface ActionOutcome {
  ok: boolean
  message: string | null
}

/**
 * Every action in actions.ts answers with the same envelope. Reading it through
 * here keeps `message` optional at the boundary and required at the call sites,
 * and makes the compiler the thing that notices if that envelope ever changes.
 */
function readOutcome(result: BookingActionResult): ActionOutcome {
  return { ok: result.ok, message: result.message ?? null }
}

// =============================================================================
// The editor
// =============================================================================

export interface AvailabilityEditorProps {
  calendar: BookingCalendarRow
  availability: BookingAvailabilityRow[]
  blackouts: BookingBlackoutRow[]
}

export function AvailabilityEditor({
  calendar,
  availability,
  blackouts,
}: AvailabilityEditorProps) {
  const uid = React.useId()

  // --- weekly hours ---------------------------------------------------------
  const [rows, setRows] = React.useState<DayRow[]>(() =>
    rowsFromAvailability(availability)
  )
  const savedSignature = React.useMemo(
    () => signatureOf(rulesFromAvailability(availability)),
    [availability]
  )
  const [baseline, setBaseline] = React.useState(savedSignature)

  const currentSignature = signatureOf(rulesFromRows(rows))
  const dirty = currentSignature !== baseline

  // The server sent different hours than the ones this baseline was taken from
  // — normally our own save coming back. Adopt them, unless there are edits in
  // flight that would be thrown away (adding a blackout also revalidates).
  if (savedSignature !== baseline && (!dirty || currentSignature === savedSignature)) {
    setBaseline(savedSignature)
    if (currentSignature !== savedSignature) {
      setRows(rowsFromAvailability(availability))
    }
  }

  const errors = React.useMemo(() => collectErrors(rows), [rows])
  const errorCount = Object.keys(errors).length
  const openMinutes = weeklyOpenMinutes(rows)
  const [savingHours, startSaveHours] = React.useTransition()

  function updateRow(weekday: number, change: (row: DayRow) => DayRow) {
    setRows((previous) =>
      previous.map((row) => (row.weekday === weekday ? change(row) : row))
    )
  }

  function toggleDay(weekday: number, open: boolean) {
    updateRow(weekday, (row) => ({
      ...row,
      enabled: open,
      ranges:
        row.ranges.length > 0
          ? row.ranges
          : [makeRange(DEFAULT_START, DEFAULT_END)],
    }))
  }

  function changeTime(
    weekday: number,
    rangeId: string,
    edge: "start" | "end",
    value: string
  ) {
    updateRow(weekday, (row) => ({
      ...row,
      ranges: row.ranges.map((range) =>
        range.id === rangeId ? { ...range, [edge]: value } : range
      ),
    }))
  }

  function addRange(weekday: number) {
    updateRow(weekday, (row) => {
      const next = suggestNextRange(row.ranges)
      if (!next) return row
      return { ...row, ranges: [...row.ranges, next] }
    })
  }

  function dropRange(weekday: number, rangeId: string) {
    updateRow(weekday, (row) => ({
      ...row,
      ranges: row.ranges.filter((range) => range.id !== rangeId),
    }))
  }

  function copyMonday() {
    setRows((previous) => copyMondayToWeekdays(previous))
    toast.success("Monday copied to Tuesday through Friday.")
  }

  function applyPreset() {
    setRows(weekdayPreset())
    toast.success("Weekdays set to 9:00 AM–5:00 PM.")
  }

  function saveHours() {
    if (errorCount > 0) {
      toast.error("Fix the highlighted days first.")
      return
    }
    const rules = rulesFromRows(rows)
    startSaveHours(async () => {
      try {
        const outcome = readOutcome(
          await setAvailability({ calendarId: calendar.id, rules })
        )
        if (outcome.ok) {
          setBaseline(signatureOf(rules))
          toast.success(outcome.message ?? "Weekly hours saved. Salamat!")
        } else {
          toast.error(outcome.message ?? "Could not save those hours.")
        }
      } catch {
        toast.error("Could not save those hours. Try again in a bit.")
      }
    })
  }

  // --- country and timezone -------------------------------------------------
  const [country, setCountry] = React.useState(calendar.country || DEFAULT_COUNTRY)
  const [timezone, setTimezone] = React.useState(
    calendar.timezone || DEFAULT_TIMEZONE
  )
  const [savingPlace, startSavePlace] = React.useTransition()

  const suggested = React.useMemo(
    () => suggestedZones(country, timezone),
    [country, timezone]
  )
  const suggestedSet = React.useMemo(() => new Set(suggested), [suggested])
  // Four hundred zones is a lot of elements to rebuild on every keystroke
  // elsewhere on the screen, so the long half of the list is built once.
  const timezoneGroups = React.useMemo(
    () =>
      TIMEZONE_AREAS.map((group) => {
        const zones = group.zones.filter((zone) => !suggestedSet.has(zone))
        if (zones.length === 0) return null
        return (
          <SelectGroup key={group.area}>
            <SelectLabel>{group.area}</SelectLabel>
            {zones.map((zone) => (
              <SelectItem key={zone} value={zone}>
                {zoneLabel(zone)}
              </SelectItem>
            ))}
          </SelectGroup>
        )
      }),
    [suggestedSet]
  )
  // A runtime without Intl.supportedValuesOf knows only the shortlist, so any
  // suggested zone missing from it still needs a label for the trigger.
  const timezoneItems = React.useMemo(() => {
    const extra = suggested.filter((zone) => !ALL_TIMEZONES.includes(zone))
    return extra.length === 0
      ? TIMEZONE_ITEMS
      : [
          ...extra.map((zone) => ({ label: zoneLabel(zone), value: zone })),
          ...TIMEZONE_ITEMS,
        ]
  }, [suggested])

  function commitPlace(nextCountry: string, nextTimezone: string) {
    const previousCountry = country
    const previousTimezone = timezone
    if (nextCountry === previousCountry && nextTimezone === previousTimezone) return

    setCountry(nextCountry)
    setTimezone(nextTimezone)

    startSavePlace(async () => {
      try {
        const outcome = readOutcome(
          await updateCalendar({
            calendarId: calendar.id,
            country: nextCountry,
            timezone: nextTimezone,
          })
        )
        if (outcome.ok) {
          toast.success(
            outcome.message ?? `Hours now run on ${zoneLabel(nextTimezone)} time.`
          )
        } else {
          setCountry(previousCountry)
          setTimezone(previousTimezone)
          toast.error(outcome.message ?? "Could not save that.")
        }
      } catch {
        setCountry(previousCountry)
        setTimezone(previousTimezone)
        toast.error("Could not save that. Try again in a bit.")
      }
    })
  }

  function chooseCountry(nextCountry: string) {
    const entry = findCountry(nextCountry)
    const zones = entry?.zones ?? []
    // Keep the zone if it still belongs to the new country, else take its main one.
    const nextTimezone = zones.includes(timezone)
      ? timezone
      : (zones[0] ?? timezone)
    commitPlace(nextCountry, nextTimezone)
  }

  // --- the live clock, and today, both client-only to keep hydration quiet ---
  const tick = useNowTick(30_000)
  const now = React.useMemo(() => (tick === null ? null : new Date(tick)), [tick])

  const zoneClock = now ? timeInZone(now, timezone) : null
  const zoneDay = now ? dayInZone(now, timezone) : null
  const zoneOffset = now ? gmtLabel(zoneOffsetMinutes(now, timezone)) : null
  const todayIso = now ? isoDateInZone(now, timezone) : null

  // --- blackout dates -------------------------------------------------------
  const [blackoutDate, setBlackoutDate] = React.useState("")
  const [blackoutReason, setBlackoutReason] = React.useState("")
  const [blackoutError, setBlackoutError] = React.useState<string | null>(null)
  const [addingBlackout, startAddBlackout] = React.useTransition()
  const [removingId, setRemovingId] = React.useState<string | null>(null)
  const [, startRemoveBlackout] = React.useTransition()

  const months = React.useMemo(
    () => groupBlackoutsByMonth(blackouts, todayIso),
    [blackouts, todayIso]
  )

  function submitBlackout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const date = blackoutDate.trim()

    if (!isValidIsoDate(date)) {
      setBlackoutError("Pick a date first.")
      return
    }
    // Caught here rather than letting the unique index throw at the database.
    if (hasBlackout(blackouts, date)) {
      setBlackoutError(`${formatIsoLong(date)} is already blocked.`)
      return
    }

    setBlackoutError(null)
    const reason = blackoutReason.trim()

    startAddBlackout(async () => {
      try {
        const outcome = readOutcome(
          await addBlackout(
            reason.length > 0
              ? { calendarId: calendar.id, date, reason }
              : { calendarId: calendar.id, date }
          )
        )
        if (outcome.ok) {
          setBlackoutDate("")
          setBlackoutReason("")
          toast.success(outcome.message ?? `${formatIsoLong(date)} is blocked off.`)
        } else {
          setBlackoutError(outcome.message ?? "Could not block that date.")
        }
      } catch {
        setBlackoutError("Could not block that date. Try again in a bit.")
      }
    })
  }

  function dropBlackout(id: string, date: string) {
    setRemovingId(id)
    startRemoveBlackout(async () => {
      try {
        const outcome = readOutcome(await removeBlackout(id))
        if (outcome.ok) {
          toast.success(outcome.message ?? `${formatIsoLong(date)} is open again.`)
        } else {
          toast.error(outcome.message ?? "Could not remove that date.")
        }
      } catch {
        toast.error("Could not remove that date. Try again in a bit.")
      } finally {
        setRemovingId(null)
      }
    })
  }

  // Copying a shut or broken Monday would quietly shut or break four more days.
  const monday = rows.find((row) => row.weekday === 1)
  const canCopyMonday =
    monday !== undefined && monday.enabled && dayError(monday) === null

  return (
    <div className="grid gap-4 md:gap-6 lg:grid-cols-3 lg:items-start">
      {/* ------------------------------------------------------------------ */}
      {/* Weekly hours                                                        */}
      {/* ------------------------------------------------------------------ */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 lg:text-lg">
            <Clock3 className="size-4 text-primary" aria-hidden />
            Weekly hours
          </CardTitle>
          <CardDescription className="text-pretty">
            Every time below is read in {zoneLabel(timezone)} time.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={copyMonday}
              disabled={!canCopyMonday}
              className="h-11 flex-1 sm:h-9 sm:flex-none"
            >
              <Copy aria-hidden />
              Copy Monday to Tue–Fri
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={applyPreset}
              className="h-11 flex-1 sm:h-9 sm:flex-none"
            >
              <Sparkles aria-hidden />
              Weekdays 9–5
            </Button>
          </div>

          <div className="space-y-2.5">
            {rows.map((row) => {
              const dayName = WEEKDAY_LABELS[row.weekday]
              const labelId = `${uid}-day-${row.weekday}-label`
              const problem = errors[row.weekday]
              const canAdd = suggestNextRange(row.ranges) !== null

              return (
                <div
                  key={row.weekday}
                  className={cn(
                    "rounded-xl border p-3 transition-colors sm:p-4",
                    problem
                      ? "border-destructive/40 bg-destructive/5"
                      : row.enabled
                        ? "border-border bg-card"
                        : "border-border/60 bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={row.enabled}
                      onCheckedChange={(open) => toggleDay(row.weekday, open)}
                      aria-labelledby={labelId}
                      className="shrink-0 cursor-pointer after:-inset-x-3 after:-inset-y-3.5 after:content-['']"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        id={labelId}
                        className="text-sm font-medium sm:text-[0.95rem]"
                      >
                        {dayName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {summariseDay(row)}
                      </p>
                    </div>
                  </div>

                  {row.enabled ? (
                    <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                      {row.ranges.map((range, index) => {
                        const startId = `${uid}-d${row.weekday}-r${index}-start`
                        const endId = `${uid}-d${row.weekday}-r${index}-end`
                        return (
                          <div
                            key={range.id}
                            className="flex flex-wrap items-center gap-2"
                          >
                            {/* The pair keeps its own line: below roughly 400px
                                the remove button wraps under it rather than
                                squeezing both pickers past legibility. */}
                            <div className="flex min-w-0 grow basis-56 items-center gap-2">
                              <label htmlFor={startId} className="sr-only">
                                {dayName} opens (range {index + 1})
                              </label>
                              <Input
                                id={startId}
                                type="time"
                                value={range.start}
                                onChange={(event) =>
                                  changeTime(
                                    row.weekday,
                                    range.id,
                                    "start",
                                    event.target.value
                                  )
                                }
                                className="h-11 min-w-0 grow"
                              />
                              <span
                                aria-hidden
                                className="shrink-0 text-sm text-muted-foreground"
                              >
                                –
                              </span>
                              <label htmlFor={endId} className="sr-only">
                                {dayName} closes (range {index + 1})
                              </label>
                              <Input
                                id={endId}
                                type="time"
                                value={range.end}
                                onChange={(event) =>
                                  changeTime(
                                    row.weekday,
                                    range.id,
                                    "end",
                                    event.target.value
                                  )
                                }
                                className="h-11 min-w-0 grow"
                              />
                            </div>
                            {row.ranges.length > 1 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => dropRange(row.weekday, range.id)}
                                aria-label={`Remove ${dayName} range ${index + 1}`}
                                className="ml-auto size-11 shrink-0 text-muted-foreground hover:text-destructive"
                              >
                                <X aria-hidden />
                              </Button>
                            ) : null}
                          </div>
                        )
                      })}

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addRange(row.weekday)}
                          disabled={!canAdd}
                          className="h-11 px-2 text-muted-foreground hover:text-foreground sm:h-9"
                        >
                          <Plus aria-hidden />
                          Add another range
                        </Button>
                        {problem ? (
                          <p
                            role="alert"
                            className="flex min-w-0 items-start gap-1.5 text-xs text-destructive"
                          >
                            <TriangleAlert
                              className="mt-px size-3.5 shrink-0"
                              aria-hidden
                            />
                            <span className="text-pretty">{problem}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {errorCount > 0 ? (
                <>
                  <TriangleAlert className="size-3.5 text-destructive" aria-hidden />
                  <span>
                    {errorCount} {errorCount === 1 ? "day needs" : "days need"} a fix
                  </span>
                </>
              ) : dirty ? (
                <>
                  <span className="size-2 rounded-full bg-chart-2" aria-hidden />
                  <span>Unsaved changes · {formatOpenHours(openMinutes)}</span>
                </>
              ) : (
                <>
                  <Check className="size-3.5 text-chart-3" aria-hidden />
                  <span>Saved · {formatOpenHours(openMinutes)}</span>
                </>
              )}
            </p>
            <Button
              type="button"
              onClick={saveHours}
              disabled={savingHours || errorCount > 0}
              className="h-11 w-full sm:w-auto sm:px-6"
            >
              {savingHours ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : null}
              {savingHours ? "Saving…" : "Save weekly hours"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Place, then blackouts                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-4 md:space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="size-4 text-primary" aria-hidden />
              Where these hours are
            </CardTitle>
            <CardDescription>
              Your suki sees times in their own zone. This is the one your hours
              are written in.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-country`}>Country</Label>
              <Select
                items={COUNTRY_ITEMS}
                value={country}
                disabled={savingPlace}
                onValueChange={(next) => chooseCountry(next ?? country)}
              >
                <SelectTrigger id={`${uid}-country`} className="h-11! w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Nearby</SelectLabel>
                    {NEARBY_COUNTRIES.map((entry) => (
                      <SelectItem key={entry.code} value={entry.code}>
                        {entry.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Everywhere else</SelectLabel>
                    {OTHER_COUNTRIES.map((entry) => (
                      <SelectItem key={entry.code} value={entry.code}>
                        {entry.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-timezone`}>Timezone</Label>
              <Select
                items={timezoneItems}
                value={timezone}
                disabled={savingPlace}
                onValueChange={(next) => commitPlace(country, next ?? timezone)}
              >
                <SelectTrigger id={`${uid}-timezone`} className="h-11! w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectGroup>
                    <SelectLabel>Suggested</SelectLabel>
                    {suggested.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zoneLabel(zone)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  {timezoneGroups}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{timezone}</p>
            </div>

            {/* The one line that catches a wrong pick before anyone books. */}
            <div
              aria-live="polite"
              className="flex items-start gap-2.5 rounded-lg bg-muted/60 p-3"
            >
              <Clock3 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                {zoneClock ? (
                  <>
                    <p className="text-sm font-medium">
                      It is {zoneClock} there right now
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {zoneDay}
                      {zoneOffset ? ` · ${zoneOffset}` : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Checking the local time…
                  </p>
                )}
              </div>
              {savingPlace ? (
                <LoaderCircle
                  className="ml-auto size-4 shrink-0 animate-spin text-muted-foreground"
                  aria-hidden
                />
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarOff className="size-4 text-primary" aria-hidden />
              Days you are closed
            </CardTitle>
            <CardDescription>
              Holidays, out-of-town, family things. These beat the weekly hours.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form onSubmit={submitBlackout} className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <div className="space-y-1.5">
                  <Label htmlFor={`${uid}-blackout-date`}>Date</Label>
                  <Input
                    id={`${uid}-blackout-date`}
                    type="date"
                    value={blackoutDate}
                    min={todayIso ?? undefined}
                    onChange={(event) => {
                      setBlackoutDate(event.target.value)
                      setBlackoutError(null)
                    }}
                    className="h-11"
                    aria-invalid={blackoutError ? true : undefined}
                    aria-describedby={
                      blackoutError ? `${uid}-blackout-error` : undefined
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${uid}-blackout-reason`}>
                    Reason
                    <span className="font-normal text-muted-foreground">
                      optional
                    </span>
                  </Label>
                  <Input
                    id={`${uid}-blackout-reason`}
                    value={blackoutReason}
                    onChange={(event) => setBlackoutReason(event.target.value)}
                    placeholder="Holiday, out of town…"
                    maxLength={80}
                    className="h-11"
                  />
                </div>
              </div>

              {blackoutError ? (
                <p
                  id={`${uid}-blackout-error`}
                  role="alert"
                  className="flex items-start gap-1.5 text-xs text-destructive"
                >
                  <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                  <span className="text-pretty">{blackoutError}</span>
                </p>
              ) : null}

              <Button
                type="submit"
                variant="outline"
                disabled={addingBlackout}
                className="h-11 w-full"
              >
                {addingBlackout ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : (
                  <Plus aria-hidden />
                )}
                {addingBlackout ? "Blocking…" : "Block this date"}
              </Button>
            </form>

            {months.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                No closed days yet. Add one the moment you know about it — it is
                easier than turning bookings away.
              </p>
            ) : (
              <div className="space-y-3">
                {months.map((month) => (
                  <div key={month.key} className="space-y-1.5">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {month.label}
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {month.items.map(({ row, isPast }) => (
                        <li
                          key={row.id}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border border-border py-1 pr-1 pl-2.5",
                            isPast ? "bg-muted/30 opacity-70" : "bg-muted/50",
                            removingId === row.id && "opacity-50"
                          )}
                        >
                          <div className="min-w-0">
                            <p
                              className={cn(
                                "text-sm font-medium",
                                isPast &&
                                  "text-muted-foreground line-through decoration-muted-foreground/60"
                              )}
                            >
                              {formatIsoDay(row.date)}
                            </p>
                            {row.reason ? (
                              <p className="max-w-36 truncate text-xs text-muted-foreground">
                                {row.reason}
                              </p>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => dropBlackout(row.id, row.date)}
                            disabled={removingId === row.id}
                            aria-label={`Open ${formatIsoLong(row.date)} back up`}
                            className="relative size-9 shrink-0 text-muted-foreground after:absolute after:-inset-1 after:content-[''] hover:text-destructive"
                          >
                            {removingId === row.id ? (
                              <LoaderCircle className="animate-spin" aria-hidden />
                            ) : (
                              <X aria-hidden />
                            )}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

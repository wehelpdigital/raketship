"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BookedRowCard, type BookedRow } from "@/features/booking/booked-list"
import {
  clampPage,
  DEFAULT_PAGE_SIZE,
  matchesQuery,
  PAGE_SIZES,
  pageCount,
  pageWindow,
  paginate,
  referenceOf,
} from "@/lib/booking/booked-filter"
import {
  dayUrgency,
  longDate,
  longDateWithYear,
  relativeDayLabel,
  type DayUrgency,
} from "@/lib/booking/dates"
import { answerToText } from "@/lib/booking/fields"
import { instantInZone, isoDateInZone } from "@/lib/booking/slots"
import type { BookingFormFieldRow } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

export interface BookedBrowserProps {
  rows: BookedRow[]
  fieldsByCalendar: Record<string, BookingFormFieldRow[]>
  /** Every calendar the owner has, so the filter can name them all. */
  calendars: { id: string; name: string }[]
  variant?: "active" | "cancelled"
  /** Shown when nothing survives the search. */
  emptyLabel: string
}

const ALL = "__all__"

/**
 * How near a day is, said in colour.
 *
 * Static entries, never interpolated — the Tailwind scanner cannot see a class
 * that is built at runtime. Every pair is measured against the page it sits on,
 * in both modes: destructive 6.71 / 4.76, warning 8.03 / 10.92, muted 5.03 /
 * 6.00, all clear of 4.5:1.
 *
 * These three tokens are deliberately the ones a palette never touches —
 * paletteCss() writes only --primary, --primary-foreground, --ring, --accent,
 * --accent-foreground and --chart-1 — so a shop that picks green does not end
 * up with a green "today".
 */
const DAY_TONE: Record<DayUrgency, string> = {
  now: "bg-destructive text-destructive-foreground",
  soon: "bg-warning text-warning-foreground",
  later: "bg-muted text-muted-foreground ring-1 ring-border",
}

/**
 * Searching, filtering and paging a list of bookings.
 *
 * All of it in the browser over rows already loaded, rather than a round trip
 * per keystroke: a raket has tens or hundreds of bookings, not millions, and
 * instant is worth more here than clever. The page cap and what it means are
 * the server's business — see the Booked page.
 *
 * Rows are collapsed by default and open one at a time. A list where every row
 * is fully expanded is a list you cannot scan, and scanning is what an owner
 * opens this page to do.
 */
export function BookedBrowser({
  rows,
  fieldsByCalendar,
  calendars,
  variant = "active",
  emptyLabel,
}: BookedBrowserProps) {
  const [query, setQuery] = React.useState("")
  const [calendarId, setCalendarId] = React.useState<string>(ALL)
  const [size, setSize] = React.useState<number>(DEFAULT_PAGE_SIZE)
  const [page, setPage] = React.useState(1)
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [showFilters, setShowFilters] = React.useState(false)

  // The answers are stored keyed by field id, which is not what anyone types.
  // Flattened once so every keystroke is not re-reading the whole map.
  const searchable = React.useMemo(
    () =>
      rows.map((row) => ({
        row,
        search: {
          id: row.id,
          customerName: row.customerName,
          customerEmail: row.customerEmail,
          customerPhone: row.customerPhone,
          calendarName: row.calendarName,
          serviceName: row.serviceName,
          answerText: Object.values(row.answers ?? {})
            .map((value) => answerToText(value))
            .join(" "),
        },
      })),
    [rows]
  )

  const filtered = React.useMemo(
    () =>
      searchable
        .filter(({ row }) => calendarId === ALL || row.calendarId === calendarId)
        .filter(({ search }) => matchesQuery(search, query))
        .map(({ row }) => row),
    [searchable, calendarId, query]
  )

  /*
    Derived, not stored. Filtering can shrink the list under whatever page
    somebody is on, and a page past the end renders empty — which reads as "no
    results" when there are plenty, just not there.
  */
  const current = clampPage(page, filtered.length, size)
  const pages = pageCount(filtered.length, size)
  const shown = paginate(filtered, current, size)

  /*
    Every row carries a date, but a list of them repeats it on every single
    line. Grouped under a day heading the rows only need their time — which is
    what an owner is actually scanning for — and "Ngayon" reads faster than any
    date does.

    Grouped AFTER paging, so a heading never counts rows that are on the next
    page. Plain loop, no useMemo — the React Compiler does that better than a
    dependency array can, and `shown` is rebuilt on every keystroke anyway.
  */
  const groups: {
    key: string
    /** "Bukas", "Sa 5 araw" — null once counting days stops helping. */
    near: string | null
    urgency: DayUrgency
    /** Always written out, so a relative word never stands on its own. */
    date: string
    rows: BookedRow[]
  }[] = []
  for (const row of shown) {
    const key = instantInZone(row.startsAt, row.timezone).isoDate
    const last = groups[groups.length - 1]
    if (last && last.key === key) {
      last.rows.push(row)
      continue
    }
    // Today is read in the CALENDAR's zone, so a shop in Manila does not get
    // told "Bukas" because the owner opened this while in London.
    const today = isoDateInZone(new Date(), row.timezone)
    groups.push({
      key,
      near: relativeDayLabel(key, today),
      urgency: dayUrgency(key, today),
      // The year only earns its space when it is not this one — which on the
      // finished tab it often is not.
      date:
        key.slice(0, 4) === today.slice(0, 4)
          ? longDate(key)
          : longDateWithYear(key),
      rows: [row],
    })
  }

  const filtering = query.trim().length > 0 || calendarId !== ALL

  function reset() {
    setQuery("")
    setCalendarId(ALL)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* --- the toolbar --------------------------------------------------- */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex min-w-0 flex-1 items-end gap-2">
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Label htmlFor="booked-search" className="sr-only">
              Maghanap ng booking
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="booked-search"
                value={query}
                placeholder="Pangalan, number, serbisyo, reference…"
                autoComplete="off"
                className="h-11 pl-9"
                onChange={(event) => {
                  setQuery(event.target.value)
                  // A new search is a new list; staying on page four of the old
                  // one would show nothing and look broken.
                  setPage(1)
                }}
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Burahin ang hinahanap"
                  onClick={() => {
                    setQuery("")
                    setPage(1)
                  }}
                  className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>

          {/*
            At 390px the selects push the first booking off the screen, so
            below lg they fold away behind this. From lg they all fit across
            one row and the toggle would only be in the way. The search box
            never folds — it is the one control worth reaching for first.
          */}
          <Button
            type="button"
            variant="outline"
            aria-expanded={showFilters}
            aria-controls="booked-filters"
            className="h-11 shrink-0 gap-2 lg:hidden"
            onClick={() => setShowFilters((previous) => !previous)}
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Filter</span>
            {filtering ? (
              <span
                className="size-1.5 rounded-full bg-primary"
                aria-hidden="true"
              />
            ) : null}
          </Button>
        </div>

        <div
          id="booked-filters"
          className={cn(
            "flex-col gap-3 sm:flex-row lg:flex lg:shrink-0 lg:items-end",
            showFilters ? "flex" : "hidden"
          )}
        >
          {/* Only worth a control when there is more than one thing to pick. */}
          {calendars.length > 1 ? (
            <div className="grid gap-1.5 sm:flex-1 lg:w-56 lg:flex-none">
              <Label htmlFor="booked-calendar" className="sr-only">
                Salain ayon sa calendar
              </Label>
              <Select
                items={[
                  { label: "Lahat ng calendar", value: ALL },
                  ...calendars.map((c) => ({ label: c.name, value: c.id })),
                ]}
                value={calendarId}
                onValueChange={(next) => {
                  setCalendarId((next as string) ?? ALL)
                  setPage(1)
                }}
              >
                <SelectTrigger id="booked-calendar" className="h-11! w-full">
                  <SlidersHorizontal
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Lahat ng calendar</SelectItem>
                  {calendars.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-1.5 sm:flex-1 lg:w-36 lg:flex-none">
            <Label htmlFor="booked-size" className="sr-only">
              Ilan bawat pahina
            </Label>
            <Select
              items={PAGE_SIZES.map((n) => ({
                label: `${n} / pahina`,
                value: String(n),
              }))}
              value={String(size)}
              onValueChange={(next) => {
                const parsed = Number(next ?? DEFAULT_PAGE_SIZE)
                if (Number.isFinite(parsed)) setSize(parsed)
                setPage(1)
              }}
            >
              <SelectTrigger id="booked-size" className="h-11! w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} / pahina
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* --- what is being looked at --------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p aria-live="polite">
          {filtered.length === 0
            ? "Walang tugma"
            : filtered.length === rows.length
              ? `${rows.length} ${rows.length === 1 ? "booking" : "bookings"}`
              : `${filtered.length} sa ${rows.length}`}
        </p>
        {filtering ? (
          <Button
            type="button"
            variant="ghost"
            className="h-8 gap-1.5 px-2 text-xs"
            onClick={reset}
          >
            <X className="size-3.5" aria-hidden="true" />
            I-clear ang filter
          </Button>
        ) : null}
      </div>

      {/* --- the list ------------------------------------------------------ */}
      {shown.length === 0 ? (
        <p className="rounded-xl bg-card px-4 py-10 text-center text-sm text-pretty text-muted-foreground ring-1 ring-border">
          {filtering
            ? "Walang booking na tugma sa hinahanap mo."
            : emptyLabel}
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.key} className="space-y-2">
              {/*
                How near the day is depends on what day it is now, so a render
                that straddles midnight can disagree with the one the server
                sent. It says the right thing either side of that; it is not
                worth a warning.
              */}
              <h3
                suppressHydrationWarning
                className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1"
              >
                {group.near ? (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
                      DAY_TONE[group.urgency]
                    )}
                  >
                    {group.near}
                  </span>
                ) : null}
                <span className="text-sm font-semibold tracking-tight">
                  {group.date}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {group.rows.length}
                  {group.rows.length === 1 ? " booking" : " bookings"}
                </span>
              </h3>

              {/*
                One card for the day, hairlines between its rows. Separate cards
                per booking spent a gap of page on every row and made a busy day
                look like a stack of unrelated things; a ruled list is what a
                schedule looks like.
              */}
              <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-border">
                {group.rows.map((row) => (
                  <li key={row.id}>
                    <BookedRowCard
                      row={row}
                      fields={fieldsByCalendar[row.calendarId] ?? []}
                      variant={variant}
                      showCalendar={calendars.length > 1}
                      open={openId === row.id}
                      onToggle={() =>
                        setOpenId((previous) =>
                          previous === row.id ? null : row.id
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* --- paging -------------------------------------------------------- */}
      {pages > 1 ? (
        <nav
          aria-label="Mga pahina"
          className="flex flex-wrap items-center justify-center gap-1 pt-1"
        >
          <PageButton
            label="Nakaraan"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </PageButton>

          {pageWindow(current, pages).map((p, index) =>
            p === null ? (
              <span
                key={`gap-${index}`}
                aria-hidden="true"
                className="px-1 text-sm text-muted-foreground"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                aria-current={p === current ? "page" : undefined}
                aria-label={`Pahina ${p}`}
                onClick={() => setPage(p)}
                className={cn(
                  "h-9 min-w-9 rounded-lg px-2 text-sm font-medium tabular-nums transition-colors",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  p === current
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {p}
              </button>
            )
          )}

          <PageButton
            label="Susunod"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </PageButton>
        </nav>
      ) : null}
    </div>
  )
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export { referenceOf }

"use client"

import * as React from "react"
import { SlidersHorizontal, X } from "lucide-react"

import { useLocale, useT } from "@/components/shell/locale-provider"
import { Button } from "@/components/ui/button"
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
  grow,
  hasMore,
  INITIAL_VISIBLE,
  matchesQuery,
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
  /**
   * What is being searched for, owned by the tabs above.
   *
   * One query for all three lists: someone who flips to Cancelled while
   * looking for "Maria" is still looking for Maria.
   */
  query: string
  onClearQuery: () => void
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
 * Searching, filtering and growing a list of bookings.
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
  query,
  onClearQuery,
  emptyLabel,
}: BookedBrowserProps) {
  const t = useT()
  const locale = useLocale()
  const [calendarId, setCalendarId] = React.useState<string>(ALL)
  const [visible, setVisible] = React.useState(INITIAL_VISIBLE)
  const [openId, setOpenId] = React.useState<string | null>(null)
  // Three of these are mounted at once, one per tab, so the label's htmlFor
  // cannot be a constant.
  const uid = React.useId()

  // The answers are stored keyed by field id, which is not what anyone types.
  // Flattened once so every keystroke is not re-reading the whole map.
  const searchable = React.useMemo(
    () => rows.map((row) => ({ row, search: searchableOf(row) })),
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
    A new query is a new list. Staying at row 140 of the old one would show
    a screenful of nothing and read as broken.
  */
  const [lastQuery, setLastQuery] = React.useState(query)
  if (lastQuery !== query) {
    setLastQuery(query)
    setVisible(INITIAL_VISIBLE)
  }

  const shown = filtered.slice(0, visible)
  const more = hasMore(visible, filtered.length)

  /*
    Every row carries a date, but a list of them repeats it on every single
    line. Grouped under a day heading the rows only need their time — which is
    what an owner is actually scanning for — and "Bukas" reads faster than any
    date does.

    Grouped AFTER the cut, so a heading never counts rows that have not loaded
    yet. Plain loop, no useMemo — the React Compiler does that better than a
    dependency array can, and `shown` is rebuilt on every keystroke anyway.
  */
  const groups: {
    key: string
    /** "Bukas", "Sa loob ng limang araw" — null once counting stops helping. */
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
      near: relativeDayLabel(key, today, locale),
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
    onClearQuery()
    setCalendarId(ALL)
    setVisible(INITIAL_VISIBLE)
  }

  return (
    <div className="space-y-4">
      {/* --- the toolbar, if there is anything left to put in it ----------- */}
      {calendars.length > 1 || query.trim() ? (
        <div className="flex items-center gap-2">
          {/* Only worth a control when there is more than one thing to pick. */}
          {calendars.length > 1 ? (
            <div className="grid min-w-0 flex-1 gap-1.5 sm:max-w-64">
              <Label htmlFor={`${uid}-calendar`} className="sr-only">
                {t("booked.filter.calendar")}
              </Label>
              <Select
                items={[
                  { label: t("booked.filter.allCalendars"), value: ALL },
                  ...calendars.map((c) => ({ label: c.name, value: c.id })),
                ]}
                value={calendarId}
                onValueChange={(next) => {
                  setCalendarId((next as string) ?? ALL)
                  setVisible(INITIAL_VISIBLE)
                }}
              >
                <SelectTrigger id={`${uid}-calendar`} className="h-11! w-full">
                  <SlidersHorizontal
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>
                    {t("booked.filter.allCalendars")}
                  </SelectItem>
                  {calendars.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/*
            What is being searched for, since the box that says so is now a
            button two rows up. A filter you cannot see is a filter you will
            blame the app for.
          */}
          {query.trim() ? (
            <button
              type="button"
              onClick={onClearQuery}
              className="flex min-w-0 items-center gap-1.5 rounded-full bg-muted py-1 pr-1.5 pl-3 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="truncate">
                {t("booked.search.showing", { query: query.trim() })}
              </span>
              <X className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="sr-only">{t("booked.search.clear")}</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {/* --- what is being looked at --------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p aria-live="polite">
          {filtered.length === 0
            ? t("booked.count.none")
            : filtered.length === rows.length
              ? countLabel(t, rows.length)
              : t("booked.count.ofTotal", {
                  shown: filtered.length,
                  total: rows.length,
                })}
        </p>
        {filtering ? (
          <Button
            type="button"
            variant="ghost"
            className="h-8 gap-1.5 px-2 text-xs"
            onClick={reset}
          >
            <X className="size-3.5" aria-hidden="true" />
            {t("booked.filter.clear")}
          </Button>
        ) : null}
      </div>

      {/* --- the list ------------------------------------------------------ */}
      {shown.length === 0 ? (
        <p className="rounded-lg bg-card px-4 py-10 text-center text-sm text-pretty text-muted-foreground ring-1 ring-border">
          {filtering ? t("booked.noMatch") : emptyLabel}
        </p>
      ) : (
        /*
          ONE ruled card for the whole tab, the day headers inside it as
          tinted bands. A card per day meant a shop whose bookings land one to
          a day — the common case — never saw a single divider; now every
          booking has a hairline above it, inset to the rows' own padding
          (full-bleed reads as an edge, inset as the list continuing), and a
          new day announces itself with a full-width rule under its band.
        */
        <div className="overflow-hidden rounded-lg bg-card ring-1 ring-border">
          {groups.map((group, groupIndex) => (
            <section key={group.key}>
              {/*
                How near the day is depends on what day it is now, so a render
                that straddles midnight can disagree with the one the server
                sent. It says the right thing either side of that; it is not
                worth a warning.
              */}
              <h3
                suppressHydrationWarning
                className={cn(
                  "flex flex-wrap items-center gap-x-2 gap-y-1 bg-muted/40 px-4 py-2.5 sm:px-5",
                  groupIndex > 0 && "border-t"
                )}
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
                  {countLabel(t, group.rows.length)}
                </span>
              </h3>

              <ul>
                {group.rows.map((row) => (
                  <li key={row.id}>
                    <div aria-hidden="true" className="mx-4 border-t sm:mx-5" />
                    <BookedRowCard
                      row={row}
                      fields={fieldsByCalendar[row.calendarId] ?? []}
                      variant={variant}
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

      {/* --- more, when scrolling asks for it ------------------------------ */}
      {more ? (
        <LoadMore
          label={t("booked.more")}
          onReach={() => setVisible((n) => grow(n, filtered.length))}
        />
      ) : null}
    </div>
  )
}

/** "1 booking" / "3 bookings", in whichever language is on. */
function countLabel(
  t: (key: "booked.count.one" | "booked.count.many", params: { n: number }) => string,
  n: number
): string {
  return n === 1 ? t("booked.count.one", { n }) : t("booked.count.many", { n })
}

/**
 * The bottom of the list, which asks for more when it comes into view.
 *
 * Also a button, and not as a courtesy: an observer fires on SCROLL, and a
 * keyboard tabbing down the page never scrolls it. Whoever reaches the end
 * gets a way to go past it.
 *
 * The margin means the next rows are asked for while the last ones are still
 * on screen, so the list grows before it runs out rather than after.
 */
function LoadMore({
  label,
  onReach,
}: {
  label: string
  onReach: () => void
}) {
  const ref = React.useRef<HTMLButtonElement | null>(null)
  const reach = React.useRef(onReach)

  // Written in an effect, never in render — the React Compiler memoises
  // renders, and a ref poked during one is exactly what it cannot see.
  React.useEffect(() => {
    reach.current = onReach
  }, [onReach])

  React.useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) reach.current()
      },
      { rootMargin: "400px 0px" }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => reach.current()}
      className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span
        className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        aria-hidden="true"
      />
      {label}
    </button>
  )
}

/**
 * A booking, reduced to the text somebody might type looking for it.
 *
 * Exported because the search box lives above the tabs now and has to count
 * matches in the list it cannot see.
 */
export function searchableOf(row: BookedRow) {
  return {
    id: row.id,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    calendarName: row.calendarName,
    serviceName: row.serviceName,
    answerText: Object.values(row.answers ?? {})
      .map((value) => answerToText(value))
      .join(" "),
  }
}

export { referenceOf }

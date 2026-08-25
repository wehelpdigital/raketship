"use client"

import * as React from "react"
import { Collapsible } from "@base-ui/react/collapsible"
import { Info, Lock, Search, X } from "lucide-react"

import { useT } from "@/components/shell/locale-provider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BookedBrowser,
  searchableOf,
} from "@/features/booking/booked-browser"
import type { BookedRow } from "@/features/booking/booked-list"
import { matchesQuery } from "@/lib/booking/booked-filter"
import type { MessageKey } from "@/lib/i18n"
import type { BookingFormFieldRow } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

type TabKey = "upcoming" | "past" | "cancelled"

/**
 * The note above each list, and what it costs to keep.
 *
 * Both notes say something true and worth saying once. Neither is worth the
 * top of the screen on every visit forever, which is what a note with no way
 * to close it becomes.
 */
const NOTICE: Record<TabKey, MessageKey | null> = {
  upcoming: "booked.notice.slots",
  past: null,
  cancelled: "booked.notice.cancelled",
}

export interface BookedTabsProps {
  upcoming: BookedRow[]
  past: BookedRow[]
  cancelled: BookedRow[]
  fieldsByCalendar: Record<string, BookingFormFieldRow[]>
  calendars: { id: string; name: string }[]
}

/**
 * The three lists, and the note that belongs to whichever is showing.
 *
 * Client-side because the note can be put away and brought back, and the
 * button that brings it back sits beside the tabs — which means it has to know
 * which tab is open. The rows themselves are still fetched and flattened on
 * the server; this is only the arranging.
 */
export function BookedTabs({
  upcoming,
  past,
  cancelled,
  fieldsByCalendar,
  calendars,
}: BookedTabsProps) {
  const t = useT()
  const [tab, setTab] = React.useState<TabKey>("upcoming")
  const [putAway, setPutAway] = React.useState<Partial<Record<TabKey, boolean>>>(
    {}
  )
  const [query, setQuery] = React.useState("")
  const [searching, setSearching] = React.useState(false)

  const lists: Record<TabKey, BookedRow[]> = { upcoming, past, cancelled }

  const counts: Record<TabKey, number> = {
    upcoming: upcoming.length,
    past: past.length,
    cancelled: cancelled.length,
  }

  /*
    How many of the list behind the dialog would survive what has been typed.
    Counted here rather than reported up from the list, because the dialog
    covers the list it is describing.
  */
  const matching = query.trim()
    ? lists[tab].filter((row) => matchesQuery(searchableOf(row), query)).length
    : counts[tab]

  const noticeKey = NOTICE[tab]
  const hasNotice = noticeKey !== null && counts[tab] > 0
  const showingNotice = hasNotice && !putAway[tab]

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => setTab(next as TabKey)}
      className="gap-4 lg:gap-6"
    >
      {/* Full-bleed scroller: three labels with counts do not fit across a
          320px phone, and widening the page would break every other one. */}
      <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        <div className="flex w-max items-center gap-2">
          <TabsList className="group-data-[orientation=horizontal]/tabs:h-auto">
            <TabsTrigger value="upcoming" className="h-11 px-3 lg:h-9">
              {t("booked.tab.upcoming")}
              <Count n={counts.upcoming} />
            </TabsTrigger>
            <TabsTrigger value="past" className="h-11 px-3 lg:h-9">
              {t("booked.tab.past")}
              <Count n={counts.past} />
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="h-11 px-3 lg:h-9">
              {t("booked.tab.cancelled")}
              <Count n={counts.cancelled} />
            </TabsTrigger>
          </TabsList>

          {/*
            Where the note went. It grows out of nothing rather than appearing,
            so the tabs beside it do not look like they jumped.
          */}
          {hasNotice && !showingNotice ? (
            <button
              type="button"
              aria-label={t("booked.notice.restore")}
              title={t("booked.notice.restore")}
              onClick={() => setPutAway((was) => ({ ...was, [tab]: false }))}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground",
                "transition-colors hover:bg-muted hover:text-foreground",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                "pop-in"
              )}
            >
              <Info className="size-4" aria-hidden="true" />
            </button>
          ) : null}

          {/*
            A button, not a box. The search is used now and then; the box was
            the widest thing on the page and sat there full-time saying
            nothing. It carries a dot while a search is on, because a filter
            you cannot see is a filter you will blame the app for.
          */}
          <button
            type="button"
            aria-label={t("booked.search.open")}
            title={t("booked.search.open")}
            onClick={() => setSearching(true)}
            className={cn(
              "relative flex size-9 shrink-0 items-center justify-center rounded-lg",
              "transition-colors hover:bg-muted hover:text-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              query.trim() ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <Search className="size-4" aria-hidden="true" />
            {query.trim() ? (
              <span
                className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary"
                aria-hidden="true"
              />
            ) : null}
          </button>
        </div>
      </div>

      {/* --- the search itself, out of the way until it is wanted ---------- */}
      <Dialog open={searching} onOpenChange={setSearching}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("booked.search.title")}</DialogTitle>
            <DialogDescription className="text-pretty">
              {t("booked.search.hint")}
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              // Every keystroke narrows the lists underneath, so this is a way
              // in rather than a form to submit. Enter just gets out of the way.
              autoFocus
              value={query}
              placeholder={t("booked.search.placeholder")}
              autoComplete="off"
              aria-label={t("booked.search.open")}
              className="h-11 pl-9"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  setSearching(false)
                }
              }}
            />
            {query ? (
              <button
                type="button"
                aria-label={t("booked.search.clear")}
                onClick={() => setQuery("")}
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground" aria-live="polite">
            {matching === 0
              ? t("booked.count.none")
              : query.trim()
                ? t("booked.count.ofTotal", {
                    shown: matching,
                    total: counts[tab],
                  })
                : matching === 1
                  ? t("booked.count.one", { n: matching })
                  : t("booked.count.many", { n: matching })}
          </p>
        </DialogContent>
      </Dialog>

      <TabsContent value="upcoming" keepMounted>
        <div className="space-y-4">
          <NoticeBar
            open={tab === "upcoming" && showingNotice}
            icon={<Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />}
            text={t("booked.notice.slots")}
            dismissLabel={t("booked.notice.dismiss")}
            onDismiss={() => setPutAway((was) => ({ ...was, upcoming: true }))}
          />
          <BookedBrowser
            rows={upcoming}
            fieldsByCalendar={fieldsByCalendar}
            calendars={calendars}
            query={query}
            onClearQuery={() => setQuery("")}
            emptyLabel={t("booked.empty.upcoming")}
          />
        </div>
      </TabsContent>

      <TabsContent value="past" keepMounted>
        <BookedBrowser
          rows={past}
          fieldsByCalendar={fieldsByCalendar}
          calendars={calendars}
          query={query}
          onClearQuery={() => setQuery("")}
          emptyLabel={t("booked.empty.past")}
        />
      </TabsContent>

      <TabsContent value="cancelled" keepMounted>
        <div className="space-y-4">
          <NoticeBar
            open={tab === "cancelled" && showingNotice}
            text={t("booked.notice.cancelled")}
            dismissLabel={t("booked.notice.dismiss")}
            onDismiss={() => setPutAway((was) => ({ ...was, cancelled: true }))}
          />
          <BookedBrowser
            rows={cancelled}
            fieldsByCalendar={fieldsByCalendar}
            calendars={calendars}
            query={query}
            onClearQuery={() => setQuery("")}
            variant="cancelled"
            emptyLabel={t("booked.empty.cancelled")}
          />
        </div>
      </TabsContent>
    </Tabs>
  )
}

/**
 * A note that can be put away.
 *
 * Height-animated both ways by Base UI, which measures the panel and hands the
 * height over as a CSS variable — the list below slides up as the note closes
 * rather than jumping into the gap it left.
 */
function NoticeBar({
  open,
  icon,
  text,
  dismissLabel,
  onDismiss,
}: {
  open: boolean
  icon?: React.ReactNode
  text: string
  dismissLabel: string
  onDismiss: () => void
}) {
  return (
    <Collapsible.Root open={open}>
      <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
        <p className="flex items-start gap-2 rounded-lg bg-primary/8 px-3 py-2 text-sm text-pretty ring-1 ring-primary/20">
          {icon}
          <span className="min-w-0 flex-1 text-muted-foreground">{text}</span>
          <button
            type="button"
            aria-label={dismissLabel}
            title={dismissLabel}
            onClick={onDismiss}
            className="-my-1 -mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </p>
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}

function Count({ n }: { n: number }) {
  if (n === 0) return null
  return (
    <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
      {n}
    </span>
  )
}

"use client"

import * as React from "react"
import { Collapsible } from "@base-ui/react/collapsible"
import { ChevronDown, Search, SlidersHorizontal, Users, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LoadMore } from "@/features/booking/booked-browser"
import {
  grow,
  hasMore,
  INITIAL_VISIBLE,
} from "@/lib/booking/booked-filter"
import { longDateWithYear } from "@/lib/booking/dates"
import { clientMatches, type ClientRecord } from "@/lib/clients/derive"
import { instantInZone } from "@/lib/booking/slots"
import { cn, formatPeso } from "@/lib/utils"

const ALL = "__all__"

export interface ClientTableProps {
  clients: ClientRecord[]
  /** Every calendar any client has booked, for the filter. */
  calendars: string[]
}

/**
 * The client list: a table on a desk, a stack of cards in a hand.
 *
 * One row per PERSON. The columns an owner scans — who, how to reach them,
 * how often, how recently, how much — are fixed; everything the owner's own
 * form asked lives in the expanded panel, because those questions differ per
 * shop and a table whose columns change per account is a table nobody can
 * learn.
 *
 * Search, filter and growth happen in the browser over people already loaded,
 * for the same reason the Booked page does it: hundreds of clients, not
 * millions, and instant beats a round trip per keystroke.
 */
export function ClientTable({ clients, calendars }: ClientTableProps) {
  const [query, setQuery] = React.useState("")
  const [calendar, setCalendar] = React.useState<string>(ALL)
  const [visible, setVisible] = React.useState(INITIAL_VISIBLE)
  const [openKey, setOpenKey] = React.useState<string | null>(null)
  const uid = React.useId()

  const filtered = clients
    .filter(
      (client) => calendar === ALL || client.calendars.includes(calendar)
    )
    .filter((client) => clientMatches(client, query))

  const shown = filtered.slice(0, visible)
  const more = hasMore(visible, filtered.length)
  const filtering = query.trim().length > 0 || calendar !== ALL

  if (clients.length === 0) {
    return (
      <div className="rounded-lg bg-card p-8 text-center ring-1 ring-border">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-chart-4/12 text-chart-4">
          <Users className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-3 font-medium">Wala pang client</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-pretty text-muted-foreground">
          Kapag may nag-book sa public link mo, lalabas sila dito — isang tao,
          isang linya, kasama ang lahat ng sagot nila.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* --- the toolbar --------------------------------------------------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Label htmlFor={`${uid}-search`} className="sr-only">
            Maghanap ng client
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={`${uid}-search`}
              value={query}
              placeholder="Pangalan, number, email, sagot…"
              autoComplete="off"
              className="h-11 pl-9"
              onChange={(event) => {
                setQuery(event.target.value)
                setVisible(INITIAL_VISIBLE)
              }}
            />
            {query ? (
              <button
                type="button"
                aria-label="Burahin ang hinahanap"
                onClick={() => {
                  setQuery("")
                  setVisible(INITIAL_VISIBLE)
                }}
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        {calendars.length > 1 ? (
          <div className="grid gap-1.5 sm:w-56">
            <Label htmlFor={`${uid}-calendar`} className="sr-only">
              Salain ayon sa calendar
            </Label>
            <Select
              items={[
                { label: "Lahat ng calendar", value: ALL },
                ...calendars.map((name) => ({ label: name, value: name })),
              ]}
              value={calendar}
              onValueChange={(next) => {
                setCalendar((next as string) ?? ALL)
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
                <SelectItem value={ALL}>Lahat ng calendar</SelectItem>
                {calendars.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filtered.length === 0
          ? "Walang tugma"
          : filtered.length === clients.length
            ? `${clients.length} client${clients.length === 1 ? "" : "s"}`
            : `${filtered.length} sa ${clients.length}`}
      </p>

      {/* --- the table ----------------------------------------------------- */}
      {shown.length === 0 ? (
        <p className="rounded-lg bg-card px-4 py-10 text-center text-sm text-pretty text-muted-foreground ring-1 ring-border">
          Walang client na tugma sa hinahanap mo.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg bg-card ring-1 ring-border">
          {/*
            The header row only exists where there are columns to head. Below
            lg the row is two stacked lines and headings would label nothing.
          */}
          <div
            aria-hidden="true"
            className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_6rem_8rem_6rem_2rem] items-center gap-3 border-b bg-muted/40 px-4 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase lg:grid lg:px-5"
          >
            <span>Client</span>
            <span>Contact</span>
            <span className="text-right">Bookings</span>
            <span className="text-right">Huling booking</span>
            <span className="text-right">Total</span>
            <span />
          </div>

          <ul>
            {shown.map((client, index) => (
              <li key={client.key}>
                {index > 0 ? (
                  <div aria-hidden="true" className="border-t" />
                ) : null}
                <ClientRow
                  client={client}
                  open={openKey === client.key}
                  onToggle={() =>
                    setOpenKey((previous) =>
                      previous === client.key ? null : client.key
                    )
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {more ? (
        <LoadMore
          label="Marami pang client"
          onReach={() => setVisible((n) => grow(n, filtered.length))}
        />
      ) : null}

      {filtering && filtered.length > 0 ? (
        <p className="text-center">
          <button
            type="button"
            onClick={() => {
              setQuery("")
              setCalendar(ALL)
              setVisible(INITIAL_VISIBLE)
            }}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            I-clear ang filter
          </button>
        </p>
      ) : null}
    </div>
  )
}

/** One person: a scannable line closed, everything they ever said open. */
function ClientRow({
  client,
  open,
  onToggle,
}: {
  client: ClientRecord
  open: boolean
  onToggle: () => void
}) {
  const last = instantInZone(client.lastAt, "Asia/Manila")

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={onToggle}
      render={
        <article className={cn("transition-colors", open && "bg-muted/40")} />
      }
    >
      <Collapsible.Trigger className="w-full px-4 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:px-5">
        {/*
          One element, two layouts: stacked lines on a phone, table columns
          from lg — the same markup, so the two can never disagree on content.
        */}
        <div className="flex items-center gap-3 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_6rem_8rem_6rem_2rem]">
          <div className="min-w-0 flex-1 lg:flex-none">
            <p className="truncate text-sm font-medium">{client.name}</p>
            <p className="truncate text-xs text-muted-foreground lg:hidden">
              {client.phone ?? client.email ?? "Walang contact"}
              {` · ${client.bookings} booking${client.bookings === 1 ? "" : "s"}`}
            </p>
          </div>

          <p className="hidden min-w-0 truncate text-sm text-muted-foreground lg:block">
            {client.phone ?? client.email ?? "Walang iniwan"}
          </p>

          <p className="hidden text-right text-sm tabular-nums lg:block">
            {client.bookings}
            {client.cancelled > 0 ? (
              <span className="text-xs text-muted-foreground">
                {` +${client.cancelled}✕`}
              </span>
            ) : null}
          </p>

          <p className="hidden text-right text-sm text-muted-foreground tabular-nums lg:block">
            {last.isoDate ? shortDay(client.lastAt) : "—"}
          </p>

          <p className="hidden text-right text-sm font-medium tabular-nums lg:block">
            {client.totalCentavos > 0 ? formatPeso(client.totalCentavos) : "—"}
          </p>

          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200 [justify-self:end] motion-reduce:transition-none",
              open && "rotate-180"
            )}
            aria-hidden="true"
          />
        </div>
      </Collapsible.Trigger>

      <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
        <div className="space-y-4 border-t px-4 pt-4 pb-5 lg:px-5">
          <dl className="grid gap-x-8 gap-y-1.5 text-sm lg:grid-cols-2">
            <Fact label="Pangalan">{client.name}</Fact>
            {client.email ? (
              <Fact label="Email">
                <a
                  href={`mailto:${client.email}`}
                  className="underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {client.email}
                </a>
              </Fact>
            ) : null}
            {client.phone ? (
              <Fact label="Mobile">
                <a
                  href={`tel:${client.phone}`}
                  className="tabular-nums underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {client.phone}
                </a>
              </Fact>
            ) : null}
            <Fact label="Bookings">
              {client.bookings}
              {client.cancelled > 0 ? ` (${client.cancelled} cancelled)` : ""}
            </Fact>
            <Fact label="Una">{shortDay(client.firstAt)}</Fact>
            <Fact label="Huli">{shortDay(client.lastAt)}</Fact>
            {client.totalCentavos > 0 ? (
              <Fact label="Total">
                <span className="tabular-nums">
                  {formatPeso(client.totalCentavos)}
                </span>
              </Fact>
            ) : null}
            <Fact label="Calendar">{client.calendars.join(", ")}</Fact>
          </dl>

          {client.answers.length > 0 ? (
            <div className="rounded-lg bg-muted/40 p-3">
              {/* The owner's own questions — the columns this CRM adapts to. */}
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Sagot sa form mo
              </p>
              <dl className="space-y-1.5 text-sm">
                {client.answers.map((answer) => (
                  <Fact key={answer.label} label={answer.label}>
                    {answer.value}
                  </Fact>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}

/** "Sunday, 1 March 2026" — the day, without the clock noise. */
function shortDay(iso: string): string {
  const day = instantInZone(iso, "Asia/Manila").isoDate
  return day ? longDateWithYear(day) : "—"
}

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-muted-foreground sm:w-24 sm:shrink-0">{label}:</dt>
      <dd className="min-w-0 flex-1 text-pretty">{children}</dd>
    </div>
  )
}

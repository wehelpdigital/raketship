"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  deleteService,
  reorderServices,
  saveService,
  setLengthMode,
  updateCalendar,
} from "@/features/booking/actions"
import { DurationPicker } from "@/features/booking/duration-picker"
import { formatDuration, validateDuration } from "@/lib/booking/slots"
import type {
  BookingCalendarRow,
  BookingLengthMode,
  BookingServiceRow,
} from "@/lib/supabase/types"
import { cn, formatPeso, parsePeso } from "@/lib/utils"

export interface LengthPanelProps {
  calendar: BookingCalendarRow
  services: BookingServiceRow[]
}

/**
 * How long a booking runs — the whole answer, in one tab.
 *
 * Two containers, both always editable, with one of them marked as the one in
 * use. Hiding the unselected half would make the catalogue unreachable from a
 * calendar that has no services yet: you cannot switch to a list you are not
 * allowed to build.
 */
export function LengthPanel({ calendar, services }: LengthPanelProps) {
  const router = useRouter()
  const [mode, setMode] = React.useState<BookingLengthMode>(calendar.length_mode)
  const [switching, startSwitching] = React.useTransition()

  // The server is the authority; if a save elsewhere changed the mode, follow.
  const [seenMode, setSeenMode] = React.useState(calendar.length_mode)
  if (seenMode !== calendar.length_mode) {
    setSeenMode(calendar.length_mode)
    setMode(calendar.length_mode)
  }

  const usable = services.length > 0

  function choose(next: BookingLengthMode) {
    if (next === mode || switching) return
    if (next === "catalog" && !usable) return

    const previous = mode
    setMode(next)
    startSwitching(async () => {
      const result = await setLengthMode({ calendarId: calendar.id, mode: next })
      if (!result.ok) {
        setMode(previous)
        toast.error(result.message ?? "We could not switch that.")
        return
      }
      toast.success(result.message ?? "Saved.")
      router.refresh()
    })
  }

  return (
    <div
      role="radiogroup"
      aria-label="How long a booking runs"
      className="grid gap-4 lg:grid-cols-5 lg:gap-6"
    >
      <OptionCard
        active={mode === "fixed"}
        busy={switching}
        icon={Clock}
        title="One length for everything"
        summary={`Every booking runs ${formatDuration(calendar.duration_minutes)}.`}
        onChoose={() => choose("fixed")}
        className="lg:col-span-2"
      >
        <FixedLength calendar={calendar} />
      </OptionCard>

      <OptionCard
        active={mode === "catalog"}
        busy={switching}
        disabled={!usable}
        disabledReason="Add a service below first."
        icon={Layers}
        title="A list of services"
        summary={
          usable
            ? "Your suki picks a service, and its length sets the slot."
            : "Each service carries its own price and length."
        }
        onChoose={() => choose("catalog")}
        className="lg:col-span-3"
      >
        <ServiceCatalog
          calendarId={calendar.id}
          services={services}
          active={mode === "catalog"}
        />
      </OptionCard>
    </div>
  )
}

/**
 * One of the two ways to answer, in its own container.
 *
 * The header is the only thing that selects — the body is full of inputs, and a
 * card that both edits and switches would fire the switch on every stray tap.
 */
function OptionCard({
  active,
  busy,
  disabled = false,
  disabledReason,
  icon: Icon,
  title,
  summary,
  onChoose,
  children,
  className,
}: {
  active: boolean
  busy: boolean
  disabled?: boolean
  disabledReason?: string
  icon: typeof Clock
  title: string
  summary: string
  onChoose: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card transition-colors",
        active ? "border-primary/40 ring-1 ring-primary/25" : "border-border",
        className
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={active}
        disabled={disabled || busy}
        onClick={onChoose}
        className={cn(
          "flex w-full items-start gap-3 p-4 text-left transition-colors sm:p-5",
          active ? "bg-primary/5" : "hover:bg-muted/50",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          disabled && "cursor-not-allowed opacity-70"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            active ? "border-primary" : "border-muted-foreground/40"
          )}
        >
          {active ? <span className="size-2.5 rounded-full bg-primary" /> : null}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-semibold">{title}</span>
            {active ? (
              <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-primary">
                In use
              </span>
            ) : null}
          </span>
          <span className="mt-1 block text-xs text-pretty text-muted-foreground">
            {disabled && disabledReason ? disabledReason : summary}
          </span>
        </span>
      </button>

      <div className="flex-1 border-t p-4 sm:p-5">{children}</div>
    </section>
  )
}

/** The static picker: hours and minutes, minutes in tens. */
function FixedLength({ calendar }: { calendar: BookingCalendarRow }) {
  const router = useRouter()
  const [minutes, setMinutes] = React.useState(calendar.duration_minutes)
  const [saving, startSaving] = React.useTransition()

  const [seen, setSeen] = React.useState(calendar.duration_minutes)
  if (seen !== calendar.duration_minutes) {
    setSeen(calendar.duration_minutes)
    setMinutes(calendar.duration_minutes)
  }

  const problem = validateDuration(minutes)
  const dirty = minutes !== calendar.duration_minutes

  function save() {
    if (problem) return
    startSaving(async () => {
      const result = await updateCalendar({
        calendarId: calendar.id,
        durationMinutes: minutes,
      })
      if (!result.ok) {
        toast.error(result.message ?? "We could not save that length.")
        return
      }
      toast.success(result.message ?? "Saved.")
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <DurationPicker value={minutes} disabled={saving} onChange={setMinutes} />

      {problem ? (
        <p role="alert" className="text-sm text-pretty text-destructive">
          {problem}
        </p>
      ) : null}

      <Button
        type="button"
        className="h-11 w-full gap-2 sm:w-auto sm:px-6"
        disabled={saving || !dirty || problem !== null}
        onClick={save}
      >
        {saving ? (
          <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
        ) : null}
        {saving ? "Saving…" : "Save length"}
      </Button>
    </div>
  )
}

/** The advanced half: what you sell, at what price, for how long. */
function ServiceCatalog({
  calendarId,
  services,
  active,
}: {
  calendarId: string
  services: BookingServiceRow[]
  active: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = React.useState<BookingServiceRow | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [pending, startPending] = React.useTransition()

  function move(index: number, by: -1 | 1) {
    const next = [...services]
    const target = index + by
    if (target < 0 || target >= next.length) return
    const [row] = next.splice(index, 1)
    next.splice(target, 0, row)

    startPending(async () => {
      const result = await reorderServices({
        calendarId,
        orderedIds: next.map((s) => s.id),
      })
      if (!result.ok) {
        toast.error(result.message ?? "We could not save that order.")
        return
      }
      router.refresh()
    })
  }

  function remove(service: BookingServiceRow) {
    startPending(async () => {
      const result = await deleteService(service.id)
      if (!result.ok) {
        toast.error(result.message ?? "We could not remove that service.")
        return
      }
      toast.success(result.message ?? "Service removed.")
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {services.length === 0 ? (
        <p className="rounded-lg bg-muted/40 px-3 py-6 text-center text-sm text-pretty text-muted-foreground">
          Nothing here yet. Add a haircut, a repair, a consultation — whatever
          your suki books, with its own price and length.
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg ring-1 ring-border">
          {services.map((service, index) => (
            <li
              key={service.id}
              className="flex items-start gap-3 bg-card p-3 transition-colors hover:bg-muted/30"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-pretty">{service.name}</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground tabular-nums">
                    {service.price_centavos === 0
                      ? "Price on request"
                      : formatPeso(service.price_centavos)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {formatDuration(service.duration_minutes)}
                  </span>
                </p>
                {service.description ? (
                  <p className="text-xs text-pretty text-muted-foreground">
                    {service.description}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                {services.length > 1 ? (
                  <>
                    <IconButton
                      label={`Move ${service.name} up`}
                      disabled={pending || index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ChevronUp className="size-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={`Move ${service.name} down`}
                      disabled={pending || index === services.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronDown className="size-4" aria-hidden="true" />
                    </IconButton>
                  </>
                ) : null}
                <IconButton
                  label={`Edit ${service.name}`}
                  disabled={pending}
                  onClick={() => setEditing(service)}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={`Remove ${service.name}`}
                  disabled={pending}
                  destructive
                  onClick={() => remove(service)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full gap-2"
        disabled={pending}
        onClick={() => setAdding(true)}
      >
        <Plus aria-hidden="true" />
        Add a service
      </Button>

      {active && services.length > 0 ? (
        <p className="text-xs text-pretty text-muted-foreground">
          Slots are cut to the service your suki picks, and still only inside the
          hours you set under Availability.
        </p>
      ) : null}

      <ServiceDialog
        calendarId={calendarId}
        open={adding}
        onOpenChange={setAdding}
        onSaved={() => router.refresh()}
      />
      <ServiceDialog
        calendarId={calendarId}
        service={editing}
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null)
        }}
        onSaved={() => {
          setEditing(null)
          router.refresh()
        }}
      />
    </div>
  )
}

function IconButton({
  label,
  disabled,
  destructive = false,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  destructive?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-9 items-center justify-center rounded-lg transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-40",
        destructive
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  )
}

/** Add or edit one service. The same fields either way. */
function ServiceDialog({
  calendarId,
  service = null,
  open,
  onOpenChange,
  onSaved,
}: {
  calendarId: string
  service?: BookingServiceRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const uid = React.useId()
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [price, setPrice] = React.useState("")
  const [minutes, setMinutes] = React.useState(30)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, startSaving] = React.useTransition()

  // Reset when a different service is opened, rather than in an effect: this
  // runs during render, so the dialog never paints the previous service first.
  const key = service?.id ?? "new"
  const [seenKey, setSeenKey] = React.useState<string | null>(null)
  if (open && seenKey !== key) {
    setSeenKey(key)
    setName(service?.name ?? "")
    setDescription(service?.description ?? "")
    setPrice(
      service && service.price_centavos > 0
        ? String(service.price_centavos / 100)
        : ""
    )
    setMinutes(service?.duration_minutes ?? 30)
    setError(null)
  }
  if (!open && seenKey !== null) setSeenKey(null)

  // An empty box means "ask me", which the list words for itself.
  const centavos = price.trim().length === 0 ? 0 : parsePeso(price)
  const lengthProblem = validateDuration(minutes)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (centavos === null) {
      setError("Write the price in pesos, like 350 or 350.50.")
      return
    }
    if (lengthProblem) {
      setError(lengthProblem)
      return
    }

    startSaving(async () => {
      const result = await saveService({
        calendarId,
        serviceId: service?.id,
        name,
        description,
        priceCentavos: centavos,
        durationMinutes: minutes,
      })
      if (!result.ok) {
        setError(result.message ?? null)
        toast.error(result.message ?? "We could not save that service.")
        return
      }
      toast.success(result.message ?? "Saved.")
      onOpenChange(false)
      onSaved()
    })
  }

  const nameId = `${uid}-name`
  const descriptionId = `${uid}-description`
  const priceId = `${uid}-price`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {service ? `Edit “${service.name}”` : "Add a service"}
          </DialogTitle>
          <DialogDescription>
            What your suki is booking, what it costs, and how long you need for
            it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={nameId}>Service name</Label>
            <Input
              id={nameId}
              value={name}
              maxLength={80}
              required
              disabled={saving}
              autoComplete="off"
              placeholder="Gupit at shampoo"
              className="h-11"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={priceId}>Price</Label>
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
              >
                ₱
              </span>
              <Input
                id={priceId}
                value={price}
                inputMode="decimal"
                disabled={saving}
                autoComplete="off"
                placeholder="350"
                className="h-11 pl-7 tabular-nums"
                aria-invalid={centavos === null ? true : undefined}
                onChange={(event) => setPrice(event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Leave it blank to show “Price on request”.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>How long it takes</Label>
            <DurationPicker
              value={minutes}
              disabled={saving}
              hint={
                <>
                  This service takes{" "}
                  <span className="font-medium text-foreground">
                    {formatDuration(minutes)}
                  </span>{" "}
                  of your day.
                </>
              }
              onChange={setMinutes}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={descriptionId}>Description</Label>
            <Textarea
              id={descriptionId}
              value={description}
              maxLength={300}
              rows={2}
              disabled={saving}
              placeholder="Optional. Anything your suki should know."
              className="min-h-20"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-pretty text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" className="h-11" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              className="h-11 gap-2"
              disabled={saving || name.trim().length < 2}
            >
              {saving ? (
                <Loader2
                  className="motion-safe:animate-spin"
                  aria-hidden="true"
                />
              ) : null}
              {saving ? "Saving…" : service ? "Save service" : "Add service"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

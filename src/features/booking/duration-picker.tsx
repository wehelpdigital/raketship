"use client"

import * as React from "react"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  formatDuration,
  HOUR_STEPS,
  joinDuration,
  MINUTE_STEPS,
  splitDuration,
} from "@/lib/booking/slots"
import { cn } from "@/lib/utils"

export interface DurationPickerProps {
  /** Total minutes. */
  value: number
  disabled?: boolean
  /** Rendered under the two selects. Pass null to omit the readout. */
  hint?: React.ReactNode
  onChange: (minutes: number) => void
  className?: string
}

/**
 * How long one booking runs, picked as hours and minutes.
 *
 * Two selects rather than one long list: "1 hour 30 minutes" as a single
 * dropdown runs to dozens of rows, and people already think of a job as
 * "an hour and a half". Minutes move in tens because nobody sells a
 * thirty-seven minute haircut, and ragged lengths give the slot grid ragged
 * edges for no gain.
 */
export function DurationPicker({
  value,
  disabled = false,
  hint,
  onChange,
  className,
}: DurationPickerProps) {
  const uid = React.useId()
  const { hours, minutes } = splitDuration(value)

  // A stored length that predates this picker (45, say) must still be shown
  // rather than silently rounded to something the owner did not choose.
  const minuteChoices = MINUTE_STEPS.includes(
    minutes as (typeof MINUTE_STEPS)[number]
  )
    ? [...MINUTE_STEPS]
    : [...MINUTE_STEPS, minutes].sort((a, b) => a - b)

  const hourChoices = HOUR_STEPS.includes(hours as (typeof HOUR_STEPS)[number])
    ? [...HOUR_STEPS]
    : [...HOUR_STEPS, hours].sort((a, b) => a - b)

  const hoursId = `${uid}-hours`
  const minutesId = `${uid}-minutes`

  function set(next: { hours?: number; minutes?: number }) {
    onChange(
      joinDuration({
        hours: next.hours ?? hours,
        minutes: next.minutes ?? minutes,
      })
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={hoursId} className="text-xs text-muted-foreground">
            Hours
          </Label>
          <Step
            id={hoursId}
            value={hours}
            choices={hourChoices}
            disabled={disabled}
            label={(n) => String(n)}
            onChange={(next) => set({ hours: next })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={minutesId} className="text-xs text-muted-foreground">
            Minutes
          </Label>
          <Step
            id={minutesId}
            value={minutes}
            choices={minuteChoices}
            disabled={disabled}
            label={(n) => String(n).padStart(2, "0")}
            onChange={(next) => set({ minutes: next })}
          />
        </div>
      </div>

      {hint === null ? null : (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {hint ?? (
            <>
              One booking runs{" "}
              <span className="font-medium text-foreground">
                {formatDuration(value)}
              </span>
              .
            </>
          )}
        </p>
      )}
    </div>
  )
}

function Step({
  id,
  value,
  choices,
  label,
  disabled,
  onChange,
}: {
  id: string
  value: number
  choices: number[]
  label: (value: number) => string
  disabled: boolean
  onChange: (value: number) => void
}) {
  const items = choices.map((choice) => ({
    label: label(choice),
    value: String(choice),
  }))

  return (
    <Select
      items={items}
      value={String(value)}
      disabled={disabled}
      onValueChange={(next) => {
        // Base UI hands back the item's value; a cleared select gives null,
        // which Number() would happily read as zero.
        const parsed = Number(next ?? NaN)
        if (Number.isFinite(parsed)) onChange(parsed)
      }}
    >
      <SelectTrigger id={id} className="h-11! w-full tabular-nums">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

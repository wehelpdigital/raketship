"use client"

import * as React from "react"
import { Loader2, Move, RotateCcw, ZoomIn } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  DEFAULT_CROP,
  dragCrop,
  cropStyle,
  MAX_ZOOM,
  MIN_ZOOM,
  normaliseCrop,
  type ImageCrop,
} from "@/lib/business/crop"
import { cn } from "@/lib/utils"

export interface CropDialogProps {
  /** Blob URL for a file just chosen, or the stored URL of an existing image. */
  url: string
  /** The logo crops to a circle; the cover to a 3:1 banner. */
  shape: "circle" | "banner"
  title: string
  description: string
  /** Label for the confirm button — it commits an upload on a new picture. */
  confirmLabel: string
  crop: ImageCrop
  open: boolean
  busy?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (crop: ImageCrop) => void
}

/** The frame's width in the dialog; the banner is a third as tall. */
const FRAME = 264

/**
 * Choosing which part of a picture survives the crop.
 *
 * Controlled and side-effect free: it hands the chosen framing back and lets
 * the caller decide what that means. That is what allows the same dialog to be
 * a step in an upload — frame it, THEN send it — as well as a way to re-frame
 * something already stored. Saving from in here would have forced the file to
 * be uploaded before it could be looked at.
 *
 * What you see is exactly what renders elsewhere: the preview uses the same
 * cropStyle() the real frames do, so there is no second implementation to
 * disagree with it.
 *
 * Pointer events rather than mouse or touch: one code path covers a finger, a
 * mouse and a stylus, and setPointerCapture keeps the drag alive when the
 * pointer leaves the frame, which on a phone is most of the time.
 */
export function CropDialog({
  url,
  shape,
  title,
  description,
  confirmLabel,
  crop,
  open,
  busy = false,
  onOpenChange,
  onConfirm,
}: CropDialogProps) {
  const [value, setValue] = React.useState<ImageCrop>(() => normaliseCrop(crop))
  const dragRef = React.useRef<{ x: number; y: number; from: ImageCrop } | null>(
    null
  )

  const isCircle = shape === "circle"
  const frameHeight = isCircle ? FRAME : FRAME / 3

  // Reset when the dialog is opened, during render rather than in an effect,
  // so it never paints the previous picture's framing for a frame first.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) setValue(normaliseCrop(crop))
  }

  function down(event: React.PointerEvent<HTMLDivElement>) {
    if (busy) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, from: value }
  }

  function move(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    // Without this the browser starts a scroll or an image drag mid-gesture.
    event.preventDefault()
    setValue(
      dragCrop(
        drag.from,
        event.clientX - drag.x,
        event.clientY - drag.y,
        FRAME,
        frameHeight
      )
    )
  }

  function up(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  /** Arrow keys nudge, so this is usable without a pointer at all. */
  function key(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 10 : 2
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    const delta = moves[event.key]
    if (!delta) return
    event.preventDefault()
    setValue((previous) =>
      normaliseCrop({
        zoom: previous.zoom,
        x: previous.x + delta[0],
        y: previous.y + delta[1],
      })
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing mid-upload would strand the file half-committed.
        if (!busy) onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex justify-center">
            <div
              role="application"
              aria-label="I-drag para igalaw ang larawan"
              tabIndex={0}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onKeyDown={key}
              style={{ width: FRAME, height: frameHeight }}
              className={cn(
                "relative max-w-full touch-none overflow-hidden ring-2 ring-border select-none",
                "outline-none focus-visible:ring-4 focus-visible:ring-ring",
                isCircle ? "rounded-full" : "rounded-xl",
                busy ? "cursor-wait" : "cursor-grab active:cursor-grabbing"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                draggable={false}
                style={cropStyle(value)}
                className="pointer-events-none size-full"
              />
            </div>
          </div>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Move className="size-3.5" aria-hidden="true" />
            I-drag, o gamitin ang arrow keys
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="crop-zoom" className="flex items-center gap-1.5">
                <ZoomIn className="size-4" aria-hidden="true" />
                Laki
              </Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {value.zoom.toFixed(1)}×
              </span>
            </div>
            {/*
              A native range input: keyboard accessible, works with a screen
              reader, and the one control a phone renders well unaided.
            */}
            <input
              id="crop-zoom"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.1}
              value={value.zoom}
              disabled={busy}
              onChange={(event) =>
                setValue((previous) =>
                  normaliseCrop({ ...previous, zoom: Number(event.target.value) })
                )
              }
              className="h-11 w-full accent-primary"
            />
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="h-11 gap-1.5"
            disabled={busy}
            onClick={() => setValue(DEFAULT_CROP)}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            I-reset
          </Button>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-11 gap-2"
              disabled={busy}
              onClick={() => onConfirm(value)}
            >
              {busy ? (
                <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
              ) : null}
              {busy ? "Saving…" : confirmLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

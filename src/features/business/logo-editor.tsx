"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, Move, RotateCcw, ZoomIn } from "lucide-react"
import { toast } from "sonner"

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
import { setLogoCrop } from "@/features/business/actions"
import {
  DEFAULT_CROP,
  dragCrop,
  logoStyle,
  MAX_ZOOM,
  MIN_ZOOM,
  normaliseCrop,
  type LogoCrop,
} from "@/lib/business/logo"
import { cn } from "@/lib/utils"

export interface LogoEditorProps {
  url: string
  crop: LogoCrop
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The mask is square; this is its side in px inside the dialog. */
const MASK = 224

/**
 * Choosing which part of the logo the circle shows.
 *
 * Drag to move, slide to zoom, and what you see is exactly what the public
 * page renders — the preview uses the same logoStyle() the real mask does, so
 * there is no second implementation to disagree with it.
 *
 * Pointer events rather than mouse or touch: one code path covers a finger, a
 * mouse and a stylus, and setPointerCapture keeps the drag alive when the
 * pointer leaves the circle, which on a phone is most of the time.
 */
export function LogoEditor({
  url,
  crop,
  open,
  onOpenChange,
}: LogoEditorProps) {
  const router = useRouter()
  const [value, setValue] = React.useState<LogoCrop>(() => normaliseCrop(crop))
  const [saving, startSaving] = React.useTransition()
  const dragRef = React.useRef<{ x: number; y: number; from: LogoCrop } | null>(
    null
  )

  // Reset when the dialog is opened, during render rather than in an effect,
  // so it never paints last time's framing for a frame first.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) setValue(normaliseCrop(crop))
  }

  function down(event: React.PointerEvent<HTMLDivElement>) {
    if (saving) return
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
        MASK
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

  function save() {
    startSaving(async () => {
      const result = await setLogoCrop(value)
      if (!result.ok) {
        toast.error(result.message ?? "Hindi na-save.")
        return
      }
      toast.success(result.message ?? "Saved.")
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ayusin ang logo</DialogTitle>
          <DialogDescription>
            I-drag ang larawan para pumili kung anong parte ang lalabas sa bilog.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex justify-center">
            <div
              role="application"
              aria-label="I-drag para igalaw ang logo"
              tabIndex={0}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onKeyDown={key}
              style={{ width: MASK, height: MASK }}
              className={cn(
                "relative max-w-full touch-none overflow-hidden rounded-full ring-2 ring-border select-none",
                "outline-none focus-visible:ring-4 focus-visible:ring-ring",
                saving ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"
              )}
            >
              {/* Exactly the style the public page uses, so this preview cannot
                  drift from what a customer will actually see. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                draggable={false}
                style={logoStyle(value)}
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
              <Label htmlFor="logo-zoom" className="flex items-center gap-1.5">
                <ZoomIn className="size-4" aria-hidden="true" />
                Laki
              </Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {value.zoom.toFixed(1)}×
              </span>
            </div>
            {/*
              A native range input: it is keyboard accessible, it works with a
              screen reader, and it is the one control a phone renders well
              without any help from us.
            */}
            <input
              id="logo-zoom"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.1}
              value={value.zoom}
              disabled={saving}
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
            disabled={saving}
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
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-11 gap-2"
              disabled={saving}
              onClick={save}
            >
              {saving ? (
                <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
              ) : null}
              {saving ? "Saving…" : "I-save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

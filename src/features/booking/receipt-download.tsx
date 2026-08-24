"use client"

import * as React from "react"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  receiptFileName,
  truncateToWidth,
  wrapText,
  type ReceiptData,
} from "@/lib/booking/receipt"

export interface ReceiptDownloadProps extends ReceiptData {
  isoDate: string
}

/** Rendered at 2x so it is not soft when someone opens it full screen. */
const SCALE = 2
const WIDTH = 380
const PADDING = 28

/**
 * Resolves a CSS custom property to something canvas will accept.
 *
 * The tokens are oklch(), which older canvas implementations reject outright —
 * and a rejected fillStyle silently keeps the previous colour, so the receipt
 * would come out in whatever was set last rather than failing visibly. Letting
 * the browser resolve it through a real element gives back rgb(), which every
 * canvas understands.
 */
function resolveColour(token: string, fallback: string): string {
  if (typeof window === "undefined") return fallback
  const probe = document.createElement("span")
  probe.style.color = `var(${token})`
  probe.style.display = "none"
  document.body.appendChild(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()
  return resolved || fallback
}

/**
 * Saves the booking as a picture.
 *
 * Drawn rather than screenshotted: a screenshot catches the browser chrome and
 * whatever else was on screen, and it depends on the customer knowing the
 * gesture on their particular phone. This is only the booking, sized to look
 * right pasted into a chat.
 *
 * It follows the shop's colour, because the page already does and a receipt
 * that did not would be the one thing on it that looked borrowed.
 */
export function ReceiptDownload({
  businessName,
  headline,
  rows,
  reference,
  isoDate,
}: ReceiptDownloadProps) {
  const [busy, setBusy] = React.useState(false)

  async function save() {
    setBusy(true)
    try {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        toast.error("Hindi kayang gumawa ng larawan sa browser na ito.")
        return
      }

      const primary = resolveColour("--primary", "rgb(211, 37, 38)")
      const onPrimary = resolveColour("--primary-foreground", "rgb(255,255,255)")
      const ink = resolveColour("--foreground", "rgb(20,20,20)")
      const muted = resolveColour("--muted-foreground", "rgb(120,120,120)")
      const card = resolveColour("--card", "rgb(255,255,255)")
      const line = resolveColour("--border", "rgb(230,230,230)")

      const font = (size: number, weight = "400") =>
        `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`

      // --- measure first, so the canvas is exactly as tall as the content ---
      const inner = WIDTH - PADDING * 2
      ctx.font = font(20, "600")
      const headlineLines = wrapText(headline, inner, (t) => ctx.measureText(t).width)

      const headerHeight = 132 + (headlineLines.length - 1) * 26
      let bodyHeight = 16
      for (const row of rows) {
        bodyHeight += 46
        if (row.note) bodyHeight += 16
      }
      const footerHeight = reference ? 86 : 42
      const height = headerHeight + bodyHeight + footerHeight

      canvas.width = WIDTH * SCALE
      canvas.height = height * SCALE
      ctx.scale(SCALE, SCALE)

      // --- the card ---------------------------------------------------------
      ctx.fillStyle = card
      ctx.fillRect(0, 0, WIDTH, height)

      // --- the header band, in the shop's colour ----------------------------
      ctx.fillStyle = primary
      ctx.fillRect(0, 0, WIDTH, headerHeight)

      // The tick, drawn as a circle and a stroke rather than an icon font.
      const markX = WIDTH / 2
      const markY = 44
      ctx.beginPath()
      ctx.arc(markX, markY, 22, 0, Math.PI * 2)
      ctx.fillStyle = onPrimary
      ctx.fill()

      ctx.strokeStyle = primary
      ctx.lineWidth = 4
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.beginPath()
      ctx.moveTo(markX - 9, markY)
      ctx.lineTo(markX - 3, markY + 6)
      ctx.lineTo(markX + 9, markY - 7)
      ctx.stroke()

      ctx.textAlign = "center"
      ctx.fillStyle = onPrimary
      ctx.font = font(20, "600")
      let y = markY + 46
      for (const text of headlineLines) {
        ctx.fillText(text, WIDTH / 2, y)
        y += 26
      }

      ctx.font = font(13)
      ctx.globalAlpha = 0.85
      ctx.fillText(
        truncateToWidth(businessName, inner, (t) => ctx.measureText(t).width),
        WIDTH / 2,
        y + 2
      )
      ctx.globalAlpha = 1

      // --- the rows ---------------------------------------------------------
      ctx.textAlign = "left"
      y = headerHeight + 30

      for (const [index, row] of rows.entries()) {
        if (index > 0) {
          ctx.strokeStyle = line
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(PADDING, y - 24)
          ctx.lineTo(WIDTH - PADDING, y - 24)
          ctx.stroke()
        }

        ctx.fillStyle = muted
        ctx.font = font(11)
        ctx.fillText(row.label.toUpperCase(), PADDING, y - 8)

        ctx.fillStyle = ink
        ctx.font = font(15, "500")
        ctx.fillText(
          truncateToWidth(row.value, inner, (t) => ctx.measureText(t).width),
          PADDING,
          y + 12
        )
        y += 46

        if (row.note) {
          ctx.fillStyle = muted
          ctx.font = font(12)
          ctx.fillText(
            truncateToWidth(row.note, inner, (t) => ctx.measureText(t).width),
            PADDING,
            y - 20
          )
          y += 16
        }
      }

      // --- the reference ----------------------------------------------------
      if (reference) {
        ctx.fillStyle = line
        ctx.fillRect(PADDING, y - 12, inner, 44)
        ctx.fillStyle = muted
        ctx.font = font(11)
        ctx.fillText("REFERENCE", PADDING + 12, y + 6)
        ctx.textAlign = "right"
        ctx.fillStyle = ink
        ctx.font = font(15, "600")
        ctx.fillText(reference, WIDTH - PADDING - 12, y + 6)
        ctx.textAlign = "left"
        y += 48
      }

      ctx.fillStyle = muted
      ctx.font = font(11)
      ctx.textAlign = "center"
      ctx.fillText("RaketShip", WIDTH / 2, height - 14)

      // --- hand it over -----------------------------------------------------
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      )
      if (!blob) {
        toast.error("Hindi na-save ang larawan. Pakisubukan ulit.")
        return
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = receiptFileName(reference, isoDate)
      document.body.appendChild(link)
      link.click()
      link.remove()
      // Revoked on the next tick: releasing it immediately can cancel the
      // download on some browsers before it has read the blob.
      setTimeout(() => URL.revokeObjectURL(url), 10_000)

      toast.success("Na-save na ang larawan.")
    } catch {
      toast.error("Hindi na-save ang larawan. Pakisubukan ulit.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full gap-2"
      disabled={busy}
      onClick={save}
    >
      {busy ? (
        <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
      ) : (
        <Download className="size-4" aria-hidden="true" />
      )}
      {busy ? "Ginagawa…" : "I-download bilang larawan"}
    </Button>
  )
}

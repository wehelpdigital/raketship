"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Crop, ImagePlus, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { LogoEditor } from "@/features/business/logo-editor"
import { LogoMask } from "@/features/business/logo-mask"
import { normaliseCrop, type LogoCrop } from "@/lib/business/logo"
import {
  removeBusinessImage,
  uploadBusinessImage,
} from "@/features/business/actions"
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/business/media"
import { cn } from "@/lib/utils"

export interface ImageFieldProps {
  kind: "logo" | "cover"
  label: string
  hint: string
  /** Public URL of what is stored now, or null. */
  url: string | null
  /** Logo only: which part of it the circle shows. */
  crop?: Partial<LogoCrop> | null
  /** Logo only: the business name, for the initials fallback. */
  name?: string | null
  disabled?: boolean
}

/**
 * One image, uploaded straight to storage through a server action.
 *
 * The preview is a blob URL held only while the upload is in flight, so the
 * picture appears the instant it is chosen rather than after a round trip. It
 * is revoked on unmount — a blob URL that is never revoked pins the whole file
 * in memory for the life of the tab.
 */
export function ImageField({
  kind,
  label,
  hint,
  url,
  crop,
  name = null,
  disabled = false,
}: ImageFieldProps) {
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [framing, setFraming] = React.useState(false)

  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const shown = preview ?? url
  const isLogo = kind === "logo"

  async function choose(file: File) {
    // Checked here so an obvious mistake costs no upload; the action and the
    // bucket both check again, because a browser check is a courtesy and not
    // a control.
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Ang laki ng file — 5MB lang po ang kaya.")
      return
    }
    if (!IMAGE_TYPES.includes(file.type)) {
      toast.error("PNG, JPG, WEBP o AVIF lang po.")
      return
    }

    const local = URL.createObjectURL(file)
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return local
    })
    setBusy(true)

    try {
      const payload = new FormData()
      payload.set("kind", kind)
      payload.set("file", file)

      const result = await uploadBusinessImage(payload)
      if (!result.ok) {
        setPreview((old) => {
          if (old) URL.revokeObjectURL(old)
          return null
        })
        toast.error(result.message ?? "Hindi na-upload.")
        return
      }
      toast.success(result.message ?? "Saved.")
      router.refresh()
    } catch {
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old)
        return null
      })
      toast.error("Something went wrong. Pakisubukan ulit.")
    } finally {
      setBusy(false)
    }
  }

  async function clear() {
    setBusy(true)
    try {
      const result = await removeBusinessImage(kind)
      if (!result.ok) {
        toast.error(result.message ?? "Hindi natanggal.")
        return
      }
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old)
        return null
      })
      toast.success(result.message ?? "Tinanggal na.")
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {shown ? (
          <span className="flex items-center gap-1">
            {/* Only the logo is masked to a circle, so only the logo has a
                part of itself to choose. A blob: preview has not been stored
                yet, so there is nothing to reframe until the upload lands. */}
            {isLogo && url ? (
              <Button
                type="button"
                variant="ghost"
                className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                disabled={busy || disabled}
                onClick={() => setFraming(true)}
              >
                <Crop className="size-3.5" aria-hidden="true" />
                Ayusin
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive"
              disabled={busy || disabled}
              onClick={clear}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Tanggalin
            </Button>
          </span>
        ) : null}
      </div>

      <label
        className={cn(
          "relative flex cursor-pointer items-center justify-center overflow-hidden border border-dashed border-input bg-muted/40 transition-colors",
          "hover:border-ring has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
          // The logo is masked to a circle everywhere it appears, so it is
          // shown as one here too — a square preview of a round thing tells
          // the owner nothing about what will be cut off.
          isLogo
            ? "size-24 rounded-full sm:size-28"
            : "aspect-[3/1] w-full rounded-xl",
          (busy || disabled) && "pointer-events-none opacity-60"
        )}
      >
        {shown ? (
          isLogo ? (
            <LogoMask
              url={shown}
              name={name}
              // A freshly chosen file has not been framed yet, so it previews
              // centred; the stored crop applies once the upload lands.
              crop={preview ? undefined : normaliseCrop(crop)}
              className="size-full ring-0"
            />
          ) : (
            /* A blob: URL has no intrinsic size to hand next/image, and the
               bucket already caps these at 5MB. */
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="size-full object-cover" />
          )
        ) : (
          <span className="flex flex-col items-center gap-1 px-3 text-center text-muted-foreground">
            <ImagePlus className="size-5" aria-hidden="true" />
            <span className="text-xs text-pretty">{hint}</span>
          </span>
        )}

        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2
              className="size-5 text-foreground motion-safe:animate-spin"
              aria-hidden="true"
            />
          </span>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          disabled={busy || disabled}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            // Cleared so choosing the same file twice still fires a change.
            event.target.value = ""
            if (file) void choose(file)
          }}
        />
        <span className="sr-only">{label}</span>
      </label>

      {isLogo && url ? (
        <LogoEditor
          url={url}
          crop={normaliseCrop(crop)}
          open={framing}
          onOpenChange={setFraming}
        />
      ) : null}
    </div>
  )
}

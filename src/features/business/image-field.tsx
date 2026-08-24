"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Crop, ImagePlus, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  removeBusinessImage,
  setBusinessImage,
  setImageCrop,
} from "@/features/business/actions"
import { CropDialog } from "@/features/business/crop-dialog"
import { LogoMask } from "@/features/business/logo-mask"
import { cropStyle, normaliseCrop, type ImageCrop } from "@/lib/business/crop"
import {
  IMAGE_ACCEPT,
  isUnrenderablePhoto,
  MAX_IMAGE_BYTES,
  MEDIA_BUCKET,
  mediaPath,
  normaliseImageType,
} from "@/lib/business/media"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export interface ImageFieldProps {
  kind: "logo" | "cover"
  label: string
  hint: string
  /** Public URL of what is stored now, or null. */
  url: string | null
  crop?: Partial<ImageCrop> | null
  /** The business name, for the logo's initials fallback. */
  name?: string | null
  disabled?: boolean
}

/** What the field is doing. Exactly one of these at a time. */
type Phase =
  | { step: "idle" }
  | { step: "manage" }
  /** A file has been chosen and is being framed. Nothing is uploaded yet. */
  | { step: "framing"; file: File; type: string; preview: string }
  /** Re-framing something already stored. */
  | { step: "reframing" }

/**
 * One picture: choose it, frame it, and only then does it upload.
 *
 * The framing is a STEP IN THE UPLOAD rather than a thing to go back and fix.
 * Uploading first would put the wrong crop on a public page for as long as it
 * took to notice, and would spend a raketero's mobile data on a picture they
 * were about to reposition anyway.
 *
 * Once there IS a picture, the picture is the control — tapping it opens the
 * choices. That is one large target instead of a row of small buttons above
 * it, which at 390px is the difference between hitting the right thing and not.
 *
 * The bytes never pass through a server action; see setBusinessImage() for why.
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
  const [phase, setPhase] = React.useState<Phase>({ step: "idle" })
  const [busy, setBusy] = React.useState(false)

  const isLogo = kind === "logo"
  const stored = normaliseCrop(crop)

  // A blob URL that is never revoked pins the whole file in memory for the life
  // of the tab, so the one held for framing is released when it is done with.
  const dropPreview = React.useCallback(() => {
    setPhase((previous) => {
      if (previous.step === "framing") URL.revokeObjectURL(previous.preview)
      return { step: "idle" }
    })
  }, [])

  React.useEffect(() => dropPreview, [dropPreview])

  function pickFile() {
    setPhase({ step: "idle" })
    inputRef.current?.click()
  }

  /** Chosen, but not sent anywhere yet — framing comes first. */
  function chosen(file: File) {
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Ang laki ng file — 5MB lang po ang kaya.")
      return
    }

    /*
      What the browser calls the file is not always what the bucket lists. A
      .jpg is reported as image/jpg on some systems, and anything that has been
      through a chat app often arrives with no type at all.
    */
    const type = normaliseImageType(file.name, file.type)
    if (!type) {
      toast.error(
        isUnrenderablePhoto(file.name, file.type)
          ? "Hindi pa kayang ipakita ang HEIC dito. I-save muna bilang JPG."
          : "PNG, JPG, WEBP o AVIF lang po."
      )
      return
    }

    setPhase({ step: "framing", file, type, preview: URL.createObjectURL(file) })
  }

  /** The end of the framing step: now it is worth spending the upload on. */
  async function uploadFramed(framed: ImageCrop) {
    if (phase.step !== "framing") return

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      toast.error("Hindi pa nakakonekta ang RaketShip sa database nito.")
      return
    }

    setBusy(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        toast.error("Hindi namin masabi kung sino ka. Mag-sign in ulit.")
        return
      }

      const path = mediaPath(user.id, kind, phase.type, Date.now())
      const { error } = await supabase.storage
        .from(MEDIA_BUCKET)
        // The canonical type, not the reported one — the bucket matches its
        // allowed list literally, so image/jpg would be turned away.
        .upload(path, phase.file, { contentType: phase.type, upsert: true })

      if (error) {
        toast.error(
          /exceeded|too large|maximum/i.test(error.message)
            ? "Ang laki ng file — 5MB lang po ang kaya."
            : "Hindi na-upload ang larawan. Pakisubukan ulit."
        )
        return
      }

      // Path and framing land together, so the picture is never live for a
      // moment in a crop nobody chose.
      const result = await setBusinessImage({ kind, path, crop: framed })
      if (!result.ok) {
        // The row never pointed at it, so the file would be an orphan.
        await supabase.storage.from(MEDIA_BUCKET).remove([path])
        toast.error(result.message ?? "Hindi na-save.")
        return
      }

      dropPreview()
      toast.success(result.message ?? "Saved.")
      router.refresh()
    } catch {
      toast.error("Something went wrong. Pakisubukan ulit.")
    } finally {
      setBusy(false)
    }
  }

  /** Re-framing something already stored: no bytes move. */
  async function saveCrop(framed: ImageCrop) {
    setBusy(true)
    try {
      const result = await setImageCrop({ kind, crop: framed })
      if (!result.ok) {
        toast.error(result.message ?? "Hindi na-save.")
        return
      }
      setPhase({ step: "idle" })
      toast.success(result.message ?? "Saved.")
      router.refresh()
    } catch {
      toast.error("Something went wrong. Pakisubukan ulit.")
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      const result = await removeBusinessImage(kind)
      if (!result.ok) {
        toast.error(result.message ?? "Hindi natanggal.")
        return
      }
      setPhase({ step: "idle" })
      toast.success(result.message ?? "Tinanggal na.")
      router.refresh()
    } catch {
      toast.error("Something went wrong. Pakisubukan ulit.")
    } finally {
      setBusy(false)
    }
  }

  const frameClass = isLogo
    ? "size-24 rounded-full sm:size-28"
    : "aspect-[3/1] w-full rounded-xl"

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium">{label}</span>

      {url ? (
        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => setPhase({ step: "manage" })}
          aria-label={`Baguhin ang ${label.toLowerCase()}`}
          className={cn(
            "relative block overflow-hidden ring-1 ring-border transition-shadow",
            "outline-none hover:ring-2 hover:ring-ring",
            "focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-60",
            frameClass
          )}
        >
          {isLogo ? (
            <LogoMask
              url={url}
              name={name}
              crop={stored}
              className="size-full ring-0"
            />
          ) : (
            /* A storage URL with no intrinsic size to hand next/image, already
               capped at 5MB by the bucket. */
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" style={cropStyle(stored)} className="size-full" />
          )}

          {busy ? (
            <span className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2
                className="size-5 text-foreground motion-safe:animate-spin"
                aria-hidden="true"
              />
            </span>
          ) : null}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy || disabled}
          onClick={pickFile}
          className={cn(
            "flex items-center justify-center border border-dashed border-input bg-muted/40 transition-colors",
            "hover:border-ring focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            "disabled:opacity-60",
            frameClass
          )}
        >
          <span className="flex flex-col items-center gap-1 px-3 text-center text-muted-foreground">
            <ImagePlus className="size-5" aria-hidden="true" />
            <span className="text-xs text-pretty">{hint}</span>
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        disabled={busy || disabled}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Cleared so choosing the same file twice still fires a change.
          event.target.value = ""
          if (file) chosen(file)
        }}
      />

      {/* --- what to do with a picture that is already there ---------------- */}
      <Dialog
        open={phase.step === "manage"}
        onOpenChange={(next) => {
          if (!next && !busy) setPhase({ step: "idle" })
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>Ano ang gusto mong gawin dito?</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-start gap-3"
              disabled={busy}
              onClick={() => setPhase({ step: "reframing" })}
            >
              <Crop className="size-4" aria-hidden="true" />
              Ayusin ang pagkakalagay
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-start gap-3"
              disabled={busy}
              onClick={pickFile}
            >
              <Upload className="size-4" aria-hidden="true" />
              Mag-upload ng bago
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-start gap-3 text-destructive hover:text-destructive"
              disabled={busy}
              onClick={remove}
            >
              {busy ? (
                <Loader2
                  className="size-4 motion-safe:animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
              Tanggalin
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- framing a file that has NOT been uploaded yet ------------------- */}
      {phase.step === "framing" ? (
        <CropDialog
          url={phase.preview}
          shape={isLogo ? "circle" : "banner"}
          title={`Ayusin ang ${label.toLowerCase()}`}
          description="Piliin kung anong parte ang lalabas. I-a-upload ito kapag okay na."
          confirmLabel="Okay, i-upload"
          crop={normaliseCrop(null)}
          open
          busy={busy}
          onOpenChange={(next) => {
            if (!next && !busy) dropPreview()
          }}
          onConfirm={uploadFramed}
        />
      ) : null}

      {/* --- re-framing what is already stored ------------------------------ */}
      {phase.step === "reframing" && url ? (
        <CropDialog
          url={url}
          shape={isLogo ? "circle" : "banner"}
          title={`Ayusin ang ${label.toLowerCase()}`}
          description="Piliin kung anong parte ang lalabas."
          confirmLabel="I-save"
          crop={stored}
          open
          busy={busy}
          onOpenChange={(next) => {
            if (!next && !busy) setPhase({ step: "idle" })
          }}
          onConfirm={saveCrop}
        />
      ) : null}
    </div>
  )
}

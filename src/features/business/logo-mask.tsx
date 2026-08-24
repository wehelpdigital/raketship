import { initialsOf } from "@/lib/business/media"
import { logoStyle, type LogoCrop } from "@/lib/business/logo"
import { cn } from "@/lib/utils"

export interface LogoMaskProps {
  /** Public URL of the logo, or null to fall back to initials. */
  url: string | null
  /** Used for the initials, and as the alt text when there is a logo. */
  name: string | null
  crop?: Partial<LogoCrop> | null
  className?: string
  /** Tailwind text size for the initials fallback. */
  textClassName?: string
}

/**
 * The logo, always a circle.
 *
 * One component for every place a logo appears, so the framing an owner sets
 * once is the framing they get on the public page, in the preview and anywhere
 * added later. A second implementation would drift from this one the first
 * time either was touched.
 *
 * `overflow-hidden` on a `rounded-full` box is what does the masking — the
 * scaled image inside is simply clipped by it.
 */
export function LogoMask({
  url,
  name,
  crop,
  className,
  textClassName,
}: LogoMaskProps) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary ring-1 ring-primary/15",
        className
      )}
    >
      {url ? (
        /* A storage URL with no intrinsic size to hand next/image, already
           capped at 5MB by the bucket. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name ? `${name} logo` : ""}
          style={logoStyle(crop)}
          className="size-full"
        />
      ) : (
        <span className={cn("select-none", textClassName)} aria-hidden="true">
          {initialsOf(name)}
        </span>
      )}
    </span>
  )
}

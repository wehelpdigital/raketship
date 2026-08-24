import { LogoMask } from "@/features/business/logo-mask"
import { mediaUrl } from "@/lib/business/media"
import type { BusinessProfileRow } from "@/lib/supabase/types"

export interface BusinessHeaderProps {
  business: BusinessProfileRow | null
  /** Used when the business has no name of its own yet. */
  fallbackName: string
}

/**
 * The shopfront at the top of a public booking link.
 *
 * Renders nothing at all when there is no cover and no logo — an empty banner
 * above every booking page would be worse than the compact header that was
 * there before, and most rakets will fill this in over time rather than on day
 * one.
 */
export function BusinessHeader({ business, fallbackName }: BusinessHeaderProps) {
  const cover = mediaUrl(business?.cover_path)
  const logo = mediaUrl(business?.logo_path)
  const name = business?.business_name?.trim() || null
  const tagline = business?.tagline?.trim() || null

  if (!cover && !logo && !name && !tagline) return null

  return (
    <div className="mb-5 overflow-hidden rounded-2xl bg-card ring-1 ring-border sm:mb-6">
      {cover ? (
        /* A storage URL with no intrinsic size to hand next/image, already
           capped at 5MB by the bucket. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          className="aspect-[3/1] w-full object-cover"
        />
      ) : null}

      <div className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
        <LogoMask
          url={logo}
          name={name ?? fallbackName}
          crop={{
            zoom: business?.logo_zoom ?? 1,
            x: business?.logo_x ?? 50,
            y: business?.logo_y ?? 50,
          }}
          className="size-12 text-base sm:size-14 sm:text-lg"
          textClassName="text-base sm:text-lg"
        />

        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-base font-semibold tracking-tight sm:text-lg">
            {name ?? fallbackName}
          </p>
          {tagline ? (
            <p className="text-sm text-pretty text-muted-foreground">{tagline}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

import type { Metadata } from "next"
import { ExternalLink, Palette, Store } from "lucide-react"

import { PageContainer, PageHeader } from "@/components/shell/page-container"
import { SetupNotice } from "@/components/shell/setup-notice"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BusinessForm } from "@/features/business/business-form"
import { ImageField } from "@/features/business/image-field"
import { PalettePicker } from "@/features/business/palette-picker"
import { initialsOf, mediaUrl } from "@/lib/business/media"
import { supabaseConfigured } from "@/lib/env"
import { getBusinessProfile } from "@/lib/queries/business"
import { getWorkspace } from "@/lib/queries/workspace"
import { DEFAULT_PALETTE } from "@/lib/theme/palettes"
import { getCurrentUser } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Your Business" }

/**
 * The business identity, in one place.
 *
 * A static segment, so it deliberately shadows /modules/[moduleId] the same way
 * /modules/booking does — this module has a bespoke home and everything else
 * falls through to the generic one.
 */
export default async function BusinessModulePage() {
  const user = await getCurrentUser()

  if (!supabaseConfigured || !user) {
    return (
      <PageContainer>
        <PageHeader
          title="Your Business"
          description="Your name, logo, colours and contact details."
        />
        <SetupNotice />
      </PageContainer>
    )
  }

  const [workspace, profile] = await Promise.all([
    getWorkspace(user.id),
    getBusinessProfile(user.id),
  ])

  const businessName = workspace.profile?.business_name ?? null
  const logoUrl = mediaUrl(profile?.logo_path)
  const coverUrl = mediaUrl(profile?.cover_path)

  return (
    <PageContainer>
      <PageHeader
        title="Your Business"
        description="Ang pangalan, hitsura at contact ng raket mo. Ito ang hinahalungkat ng lahat ng ibang module."
      />

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start lg:gap-8">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Store className="size-4 text-primary" aria-hidden="true" />
                Details
              </CardTitle>
              <CardDescription className="text-pretty">
                Ang mga sagot dito ang lumalabas sa booking page mo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BusinessForm businessName={businessName} profile={profile} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:space-y-8">
          {/* Colour and pictures save on their own, so they sit apart from the
              form and its Save button rather than inside it. */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="size-4 text-primary" aria-hidden="true" />
                Colour theme
              </CardTitle>
              <CardDescription className="text-pretty">
                Nagse-save agad. Ito ang kulay ng buong app at ng booking page mo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PalettePicker value={profile?.theme_preset ?? DEFAULT_PALETTE} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Logo at cover</CardTitle>
              <CardDescription className="text-pretty">
                5MB max. PNG, JPG, WEBP o AVIF.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ImageField
                kind="logo"
                label="Logo"
                hint="Square"
                url={logoUrl}
              />
              <ImageField
                kind="cover"
                label="Cover photo"
                hint="Malapad — tarpaulin, produkto, o shop mo"
                url={coverUrl}
              />

              {/* What the two pictures actually add up to, at the size the
                  customer sees them. A preview beats a description. */}
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Preview</p>
                <div className="overflow-hidden rounded-xl ring-1 ring-border">
                  <div className="relative aspect-[3/1] bg-muted">
                    {coverUrl ? (
                      /* A storage URL with no known intrinsic size. */
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={coverUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 p-3">
                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/15">
                      {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoUrl}
                          alt=""
                          className="size-full object-contain p-1"
                        />
                      ) : (
                        initialsOf(businessName)
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {businessName || "Ang raket mo"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {profile?.tagline || "Idagdag ang tagline mo"}
                      </span>
                    </span>
                  </div>
                </div>
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <ExternalLink
                    className="mt-0.5 size-3 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-pretty">
                    Ganito ang itsura sa itaas ng booking page mo.
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}

"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { saveBusinessProfile } from "@/features/business/actions"
import type { BusinessProfileRow } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

/** Where the same mobile number can also be reached. */
export const CHAT_APPS = [
  { value: "viber", label: "Viber" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
]

export const VISIBILITIES = [
  { value: "full", label: "Buong address" },
  { value: "area", label: "Barangay at city lang" },
  { value: "hidden", label: "Huwag ipakita" },
]

export interface BusinessFormProps {
  businessName: string | null
  profile: BusinessProfileRow | null
  readOnly?: boolean
}

interface Values {
  businessName: string
  tagline: string
  description: string
  mobileNumber: string
  chatApps: string[]
  facebookUrl: string
  instagramHandle: string
  websiteUrl: string
  streetAddress: string
  barangay: string
  city: string
  province: string
  landmark: string
  addressVisibility: string
}

function initial(
  businessName: string | null,
  profile: BusinessProfileRow | null
): Values {
  return {
    businessName: businessName ?? "",
    tagline: profile?.tagline ?? "",
    description: profile?.description ?? "",
    mobileNumber: profile?.mobile_number ?? "",
    chatApps: profile?.chat_apps ?? [],
    facebookUrl: profile?.facebook_url ?? "",
    instagramHandle: profile?.instagram_handle ?? "",
    websiteUrl: profile?.website_url ?? "",
    streetAddress: profile?.street_address ?? "",
    barangay: profile?.barangay ?? "",
    city: profile?.city ?? "",
    province: profile?.province ?? "",
    landmark: profile?.landmark ?? "",
    addressVisibility: profile?.address_visibility ?? "area",
  }
}

/**
 * Everything about the business except the colour and the pictures, which save
 * on their own because their effect is visible immediately.
 *
 * Grouped into the questions a suki actually asks — sino ka, paano kita
 * makokontak, saan ka — rather than into whatever order the columns happen to
 * sit in. An online seller can legitimately skip the last section entirely.
 */
export function BusinessForm({
  businessName,
  profile,
  readOnly = false,
}: BusinessFormProps) {
  const router = useRouter()
  const [values, setValues] = React.useState<Values>(() =>
    initial(businessName, profile)
  )
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, startSaving] = React.useTransition()

  // The server is the authority. If a save elsewhere changed the row, follow it
  // rather than leaving a stale form sitting on top of newer data.
  const stamp = `${businessName ?? ""}|${profile?.updated_at ?? ""}`
  const [seen, setSeen] = React.useState(stamp)
  if (seen !== stamp) {
    setSeen(stamp)
    setValues(initial(businessName, profile))
  }

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((previous) => ({ ...previous, [key]: value }))
  }

  function toggleChat(app: string) {
    setValues((previous) => ({
      ...previous,
      chatApps: previous.chatApps.includes(app)
        ? previous.chatApps.filter((a) => a !== app)
        : [...previous.chatApps, app],
    }))
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors({})
    setFormError(null)

    startSaving(async () => {
      try {
        const result = await saveBusinessProfile({
          ...values,
          // The picker saves the colour on its own; this send must not carry a
          // stale copy that would undo a swatch tapped a moment ago.
          themePreset: profile?.theme_preset ?? "pula",
          chatApps: values.chatApps as ("viber" | "whatsapp" | "telegram")[],
          addressVisibility: values.addressVisibility as "full" | "area" | "hidden",
        })

        if (!result.ok) {
          setErrors(result.fieldErrors ?? {})
          setFormError(result.message ?? "Hindi na-save.")
          toast.error(result.message ?? "Hindi na-save.")
          return
        }
        toast.success(result.message ?? "Saved.")
        router.refresh()
      } catch {
        const message = "Something went wrong. Pakisubukan ulit."
        setFormError(message)
        toast.error(message)
      }
    })
  }

  /** What the visibility choice actually means, said in full under the select. */
  const visibilityHint =
    values.addressVisibility === "full"
      ? "Makikita ng suki ang buong address."
      : values.addressVisibility === "area"
        ? "Barangay, city at province lang ang makikita. Itatago ang street at landmark."
        : "Walang address na lalabas sa booking page. Sa iyo pa rin ang nakatago dito."

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Section title="Sino kayo" hint="Ang unang nakikita ng suki.">
        <Field
          id="business-name"
          label="Business name"
          hint="Ito ang nasa taas ng booking page mo."
          error={errors.businessName}
        >
          <Input
            id="business-name"
            value={values.businessName}
            maxLength={80}
            disabled={saving || readOnly}
            autoComplete="organization"
            placeholder="Gupit ni Aling Nena"
            className="h-11"
            onChange={(event) => set("businessName", event.target.value)}
          />
        </Field>

        <Field
          id="tagline"
          label="Tagline"
          hint="Isang linya lang — ito rin ang lumalabas sa Messenger preview."
          error={errors.tagline}
        >
          <Input
            id="tagline"
            value={values.tagline}
            maxLength={60}
            disabled={saving || readOnly}
            placeholder="Home salon sa Marikina"
            className="h-11"
            onChange={(event) => set("tagline", event.target.value)}
          />
        </Field>

        <Field
          id="description"
          label="Description"
          hint="Ano ang ginagawa niyo, ano ang dalhin, tumatanggap ba ng walk-in."
          error={errors.description}
        >
          <Textarea
            id="description"
            value={values.description}
            maxLength={600}
            rows={4}
            disabled={saving || readOnly}
            placeholder="Gupit, kulay at rebond. Walk-in welcome kung may bakante."
            className="min-h-28"
            onChange={(event) => set("description", event.target.value)}
          />
        </Field>
      </Section>

      <Section title="Paano kayo makokontak">
        <Field
          id="mobile"
          label="Mobile number"
          hint="09xx o +639xx — pareho lang."
          error={errors.mobileNumber}
        >
          <Input
            id="mobile"
            value={values.mobileNumber}
            type="tel"
            inputMode="tel"
            maxLength={40}
            disabled={saving || readOnly}
            autoComplete="tel"
            placeholder="0917 000 0000"
            className="h-11 tabular-nums"
            aria-invalid={errors.mobileNumber ? true : undefined}
            onChange={(event) => set("mobileNumber", event.target.value)}
          />
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Chat apps</legend>
          <p className="text-xs text-muted-foreground">
            Nasa numerong nasa taas. Magiging tap-to-message ito sa booking page.
          </p>
          <div className="flex flex-wrap gap-2">
            {CHAT_APPS.map((app) => {
              const on = values.chatApps.includes(app.value)
              return (
                <button
                  key={app.value}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={saving || readOnly}
                  onClick={() => toggleChat(app.value)}
                  className={cn(
                    "h-11 rounded-full px-4 text-sm font-medium transition-colors",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    on
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-muted-foreground ring-1 ring-border hover:bg-muted"
                  )}
                >
                  {app.label}
                </button>
              )
            })}
          </div>
        </fieldset>

        <Field
          id="facebook"
          label="Facebook"
          hint="Para sa karamihan, ito na ang website."
          error={errors.facebookUrl}
        >
          <Input
            id="facebook"
            value={values.facebookUrl}
            maxLength={300}
            disabled={saving || readOnly}
            inputMode="url"
            placeholder="facebook.com/gupitninena"
            className="h-11"
            aria-invalid={errors.facebookUrl ? true : undefined}
            onChange={(event) => set("facebookUrl", event.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="instagram"
            label="Instagram"
            hint="Handle lang, walang @."
            error={errors.instagramHandle}
          >
            <Input
              id="instagram"
              value={values.instagramHandle}
              maxLength={120}
              disabled={saving || readOnly}
              placeholder="gupitninena"
              className="h-11"
              aria-invalid={errors.instagramHandle ? true : undefined}
              onChange={(event) => set("instagramHandle", event.target.value)}
            />
          </Field>

          <Field
            id="website"
            label="Website o shop link"
            hint="Shopee, TikTok Shop, Linktree — kahit alin."
            error={errors.websiteUrl}
          >
            <Input
              id="website"
              value={values.websiteUrl}
              maxLength={300}
              disabled={saving || readOnly}
              inputMode="url"
              placeholder="shopee.ph/gupitninena"
              className="h-11"
              aria-invalid={errors.websiteUrl ? true : undefined}
              onChange={(event) => set("websiteUrl", event.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Saan kayo">
        <Field
          id="address-visibility"
          label="Show address"
          hint={visibilityHint}
        >
          <Select
            items={VISIBILITIES}
            value={values.addressVisibility}
            disabled={saving || readOnly}
            onValueChange={(next) =>
              set("addressVisibility", (next as string) ?? "area")
            }
          >
            <SelectTrigger id="address-visibility" className="h-11! w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISIBILITIES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="street" label="Street and house no.">
          <Input
            id="street"
            value={values.streetAddress}
            maxLength={120}
            disabled={saving || readOnly}
            autoComplete="address-line1"
            placeholder="Blk 4 Lot 12 Sampaguita St."
            className="h-11"
            onChange={(event) => set("streetAddress", event.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
              <Field id="barangay" label="Barangay">
                <Input
                  id="barangay"
                  value={values.barangay}
                  maxLength={80}
                  disabled={saving || readOnly}
                  placeholder="Concepcion Uno"
                  className="h-11"
                  onChange={(event) => set("barangay", event.target.value)}
                />
              </Field>

              <Field id="city" label="City or municipality">
                <Input
                  id="city"
                  value={values.city}
                  maxLength={80}
                  disabled={saving || readOnly}
                  autoComplete="address-level2"
                  placeholder="Marikina City"
                  className="h-11"
                  onChange={(event) => set("city", event.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-4">
              <Field id="province" label="Province">
                <Input
                  id="province"
                  value={values.province}
                  maxLength={80}
                  disabled={saving || readOnly}
                  autoComplete="address-level1"
                  placeholder="Metro Manila"
                  className="h-11"
                  onChange={(event) => set("province", event.target.value)}
                />
              </Field>

            </div>

        {/* Its own row rather than half of one: directions here run to a
            sentence, not a phrase. */}
        <Field
          id="landmark"
          label="Landmark"
          hint="Ganito talaga magturo ng direksyon dito. Kasama ito sa itinatago kapag hindi buong address ang pinili mo."
        >
          <Textarea
            id="landmark"
            value={values.landmark}
            maxLength={300}
            rows={2}
            disabled={saving || readOnly}
            placeholder="Katapat ng Mercury Drug, kulay dilaw na gate. Tumawag na lang kapag nasa gate na."
            className="min-h-20"
            onChange={(event) => set("landmark", event.target.value)}
          />
        </Field>
      </Section>

      {formError ? (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-pretty text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="submit"
          className="h-11 gap-2 sm:px-6"
          disabled={saving || readOnly}
        >
          {saving ? (
            <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
          ) : null}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {hint ? (
          <p className="text-xs text-pretty text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-pretty text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

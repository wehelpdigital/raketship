"use client"

/**
 * Where a calendar stops being a private draft and becomes a link you can post.
 *
 * Two jobs, both fiddly: editing the slug without letting someone save a bad
 * one, and getting the finished URL onto the clipboard of whatever device this
 * is running on. Neither is allowed to fail silently.
 */

import * as React from "react"
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  Link2,
  Share2,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import { Spinner } from "@/components/shell/loader"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { setPublished, updateSlug } from "@/features/booking/actions"
import { useCanShare, useOrigin } from "@/lib/hooks/client"
import { bookingUrl, SLUG_MAX, validateSlug } from "@/lib/booking/slug"
import type { BookingCalendarRow } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

export interface SharePanelProps {
  calendar: BookingCalendarRow
}

/** Keeps what they type inside the alphabet a slug is allowed to use. */
function tidySlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-/, "")
    .slice(0, SLUG_MAX)
}

/**
 * A dash they are still typing through is not a mistake yet.
 *
 * "aling-nena" is only reachable by passing through "aling-", so complaining
 * about the trailing dash makes the field shout at every second keystroke.
 * The saved value gets the same treatment, so nobody stores one either.
 */
function settledSlug(input: string): string {
  return input.replace(/-+$/, "")
}

export function SharePanel({ calendar }: SharePanelProps) {
  const origin = useOrigin()
  const [savedSlug, setSavedSlug] = React.useState(calendar.slug)
  const [draft, setDraft] = React.useState(calendar.slug)
  const [live, setLive] = React.useState(calendar.is_published)

  const [slugError, setSlugError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [toggling, setToggling] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  const urlRef = React.useRef<HTMLInputElement>(null)
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Re-sync when the server sends a fresh row after a revalidate, so the panel
  // never argues with the database about what the slug currently is.
  const [known, setKnown] = React.useState({
    slug: calendar.slug,
    published: calendar.is_published,
  })
  if (
    known.slug !== calendar.slug ||
    known.published !== calendar.is_published
  ) {
    setKnown({ slug: calendar.slug, published: calendar.is_published })
    setSavedSlug(calendar.slug)
    setDraft(calendar.slug)
    setLive(calendar.is_published)
  }

  React.useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current)
    },
    []
  )

  const url = bookingUrl(savedSlug, origin)
  const host = origin.replace(/^https?:\/\//, "")
  const dirty = draft !== savedSlug
  const settled = settledSlug(draft)
  const liveProblem = settled.length > 0 ? validateSlug(settled) : null
  const canSave = dirty && settled.length > 0 && !liveProblem && !saving
  const canShare = useCanShare()

  function flashCopied() {
    setCopied(true)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 2200)
  }

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        flashCopied()
        return
      }
      throw new Error("clipboard unavailable")
    } catch {
      // An insecure origin, an old browser, or a refused permission. Select the
      // text instead so a long-press or Ctrl+C still gets there.
      const input = urlRef.current
      if (input) {
        input.focus()
        input.select()
        input.setSelectionRange(0, url.length)
        try {
          if (document.execCommand("copy")) {
            flashCopied()
            return
          }
        } catch {
          // Fall through to the instruction below.
        }
      }
      toast.info("Nakahighlight na ang link — pindutin nang matagal para ma-copy.")
    }
  }

  async function handleShare() {
    try {
      await navigator.share({
        title: calendar.name,
        text: `Book with ${calendar.name}`,
        url,
      })
    } catch {
      // Dismissing the sheet rejects too, so there is nothing worth saying.
    }
  }

  async function handleSaveSlug() {
    const next = settledSlug(tidySlug(draft.trim()))
    const problem = validateSlug(next)
    if (problem) {
      setSlugError(problem)
      return
    }

    setSaving(true)
    setSlugError(null)
    try {
      const outcome = await updateSlug({
        calendarId: calendar.id,
        slug: next,
      })
      if (!outcome.ok) {
        setSlugError(
          outcome.message ?? "May gumagamit na ng link na iyan. Try another."
        )
        return
      }
      setSavedSlug(next)
      setDraft(next)
      toast.success(outcome.message ?? "Link saved. Salamat!")
    } catch {
      setSlugError("We could not save that link. Pakisubukan ulit.")
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish(next: boolean) {
    setLive(next)
    setToggling(true)
    try {
      const outcome = await setPublished({
        calendarId: calendar.id,
        published: next,
      })
      if (!outcome.ok) {
        setLive(!next)
        toast.error(outcome.message ?? "We could not change that. Try again.")
        return
      }
      toast.success(
        next
          ? "Live na. Puwede mo nang i-share ang link."
          : "Naka-off muna. Walang makakabook habang draft."
      )
    } catch {
      setLive(!next)
      toast.error("We could not change that. Pakisubukan ulit.")
    } finally {
      setToggling(false)
    }
  }

  const errorText = slugError ?? (dirty ? liveProblem : null)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="size-4 text-primary" aria-hidden />
          Your booking link
        </CardTitle>
        <CardDescription>
          Ito ang ipapadala mo sa suki — sa Messenger, Viber, o sa bio mo.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* --- live or draft ------------------------------------------------ */}
        <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 p-3 ring-1 ring-border">
          <div className="min-w-0 space-y-0.5">
            <Label
              htmlFor="booking-published"
              className="text-sm font-medium"
            >
              {live ? "Live" : "Draft"}
            </Label>
            <p className="text-xs text-pretty text-muted-foreground">
              {live
                ? "Anyone with the link can book a time."
                : "Only you can see this calendar."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {toggling ? <Spinner className="size-4" label="Saving" /> : null}
            <Switch
              id="booking-published"
              checked={live}
              disabled={toggling}
              onCheckedChange={(next) => {
                void handlePublish(next)
              }}
            />
          </div>
        </div>

        {!live ? (
          <Alert>
            <TriangleAlert aria-hidden />
            <AlertTitle>The link will 404 while this is off</AlertTitle>
            <AlertDescription>
              Anyone you send it to sees a &ldquo;not found&rdquo; page, hindi
              ang booking form. Switch it on when handa ka na.
            </AlertDescription>
          </Alert>
        ) : null}

        {/* --- the slug ----------------------------------------------------- */}
        <div className="space-y-2">
          <Label htmlFor="booking-slug">Link address</Label>

          {/*
            The prefix sits inside the field so the slug never reads as a
            standalone word. At 320px only "/book/" survives — the host is the
            part a customer never types by hand anyway.
          */}
          <div
            className={cn(
              "flex w-full items-stretch overflow-hidden rounded-lg border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
              errorText && "border-destructive"
            )}
          >
            <span className="flex shrink-0 items-center gap-0 border-r border-input bg-muted/60 px-2.5 font-mono text-xs text-muted-foreground sm:px-3 sm:text-sm">
              {host ? <span className="hidden sm:inline">{host}</span> : null}
              /book/
            </span>
            <input
              id="booking-slug"
              value={draft}
              onChange={(event) => {
                setDraft(tidySlug(event.target.value))
                setSlugError(null)
              }}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              inputMode="url"
              aria-invalid={errorText ? true : undefined}
              aria-describedby="booking-slug-hint"
              className="h-11 min-w-0 flex-1 bg-transparent px-2.5 font-mono text-base outline-none placeholder:text-muted-foreground sm:px-3 md:text-sm"
              placeholder="aling-nena-gupit"
            />
          </div>

          <p
            id="booking-slug-hint"
            className={cn(
              errorText
                ? "text-sm text-destructive"
                : "text-xs text-muted-foreground"
            )}
          >
            {errorText ??
              "Lowercase letters, numbers at gitling. Keep it short enough to say out loud."}
          </p>

          <Button
            type="button"
            onClick={() => {
              void handleSaveSlug()
            }}
            disabled={!canSave}
            className="h-11 w-full sm:w-auto sm:px-5"
          >
            {saving ? "Saving…" : "Save link"}
          </Button>
        </div>

        {/* --- the finished URL --------------------------------------------- */}
        <div className="space-y-2 rounded-lg bg-muted/40 p-3 ring-1 ring-border">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Globe className="size-3.5" aria-hidden />
            {dirty ? "Currently live at" : "Share this"}
          </div>

          {/*
            A real input, not a <p>: it is the fallback target when the
            clipboard API is unavailable and the customer has to copy by hand.
          */}
          <input
            ref={urlRef}
            readOnly
            value={url}
            aria-label="Your public booking link"
            onFocus={(event) => event.currentTarget.select()}
            className="h-11 w-full min-w-0 rounded-md bg-background px-2.5 font-mono text-xs text-foreground ring-1 ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:text-sm"
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={copied ? "secondary" : "default"}
              onClick={() => {
                void handleCopy()
              }}
              className="h-11 flex-1 sm:flex-none sm:px-4"
            >
              {copied ? (
                <>
                  <Check aria-hidden />
                  Copied
                </>
              ) : (
                <>
                  <Copy aria-hidden />
                  Copy link
                </>
              )}
            </Button>

            <Button
              variant="outline"
              className="h-11 flex-1 sm:flex-none sm:px-4"
              render={<a href={url} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink aria-hidden />
              Open link
            </Button>

            {canShare ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void handleShare()
                }}
                className="h-11 flex-1 sm:flex-none sm:px-4"
              >
                <Share2 aria-hidden />
                Share
              </Button>
            ) : null}
          </div>

          {dirty ? (
            <p className="text-xs text-muted-foreground">
              Your edit is not saved yet, kaya ito pa rin ang bukás na link.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

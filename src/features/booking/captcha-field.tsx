"use client"

import * as React from "react"
import { Check, Loader2, ShieldCheck } from "lucide-react"

import { leadingZeroBits, sha256Hex } from "@/lib/booking/sha256"
import { cn } from "@/lib/utils"

export interface CaptchaValue {
  nonce: string
  issuedAt: number
  signature: string
  solution: number
  honeypot: string
}

export interface CaptchaFieldProps {
  nonce: string
  issuedAt: number
  signature: string
  /** How many leading zero bits the server will insist on. */
  bits: number
  disabled?: boolean
  onChange: (value: CaptchaValue | null) => void
}

/** How many hashes to try before handing the thread back to the browser. */
const SLICE = 2000

/**
 * The anti-robot check every public booking form carries.
 *
 * It starts working the moment the page loads rather than when the customer
 * reaches it, so by the time they have picked a service, a day and a time the
 * answer is already sitting there and the box just says yes. The wizard is
 * several steps long; there is no reason to make anybody wait at the end of it.
 *
 * The work is sliced and yields between slices. Doing sixty-five thousand
 * hashes in one go would freeze the page on the cheap Android most suki are
 * holding, and a frozen page is indistinguishable from a broken one.
 *
 * There is no way to turn this off, and it is not in the form builder. A
 * raketero should not have to know what a bot is, and an owner who COULD switch
 * it off would eventually be the one who did.
 */
export function CaptchaField({
  nonce,
  issuedAt,
  signature,
  bits,
  disabled = false,
  onChange,
}: CaptchaFieldProps) {
  const [solution, setSolution] = React.useState<number | null>(null)
  const [honeypot, setHoneypot] = React.useState("")
  const uid = React.useId()

  // A new challenge means the old answer is worthless. Cleared during render
  // rather than in an effect, so there is never a frame where a stale solution
  // is being offered for a nonce it does not solve.
  const [seenNonce, setSeenNonce] = React.useState(nonce)
  if (seenNonce !== nonce) {
    setSeenNonce(nonce)
    setSolution(null)
  }

  // The callback is held in a ref so a parent re-render cannot restart the
  // work: solving again from zero on every keystroke would be its own outage.
  const onChangeRef = React.useRef(onChange)
  React.useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  React.useEffect(() => {
    let cancelled = false
    let counter = 0
    let pending: ReturnType<typeof setTimeout> | undefined

    function work() {
      if (cancelled) return
      const until = counter + SLICE
      for (; counter < until; counter++) {
        if (leadingZeroBits(sha256Hex(`${nonce}:${counter}`)) >= bits) {
          if (!cancelled) setSolution(counter)
          return
        }
      }
      // Back to the browser, so scrolling and typing stay smooth.
      pending = setTimeout(work, 0)
    }

    // Started on a later tick, never synchronously: the first slice finding an
    // answer would otherwise set state during the effect itself.
    const started = setTimeout(work, 0)
    return () => {
      cancelled = true
      clearTimeout(started)
      if (pending) clearTimeout(pending)
    }
  }, [nonce, bits])

  React.useEffect(() => {
    onChangeRef.current(
      solution === null
        ? null
        : { nonce, issuedAt, signature, solution, honeypot }
    )
  }, [solution, nonce, issuedAt, signature, honeypot])

  const ready = solution !== null

  return (
    <div className="space-y-2">
      {/*
        The honeypot. Hidden from people by position rather than by
        `display: none`, which the better bots know to skip, and taken out of
        the tab order and the accessibility tree so nobody can reach it by
        accident. Anything in it was typed by a script.
      */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-[9999px] opacity-0">
        <label htmlFor={`${uid}-website`}>Website</label>
        <input
          id={`${uid}-website`}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      <div
        className={cn(
          "flex items-center gap-3 rounded-xl px-4 py-3 ring-1 transition-colors",
          ready
            ? "bg-primary/8 ring-primary/25"
            : "bg-muted/40 ring-border"
        )}
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md",
            ready ? "bg-primary text-primary-foreground" : "bg-muted-foreground/15"
          )}
        >
          {ready ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Loader2
              className="size-3.5 text-muted-foreground motion-safe:animate-spin"
              aria-hidden="true"
            />
          )}
        </span>

        <p className="min-w-0 flex-1 text-sm" aria-live="polite">
          {ready ? (
            <span className="font-medium">Hindi ka robot. Salamat!</span>
          ) : (
            <span className="text-muted-foreground">
              Sinisiguro lang naming tao ka…
            </span>
          )}
        </p>

        <ShieldCheck
          className={cn(
            "size-4 shrink-0",
            ready ? "text-primary" : "text-muted-foreground/50"
          )}
          aria-hidden="true"
        />
      </div>

      {/* Only worth saying while it is still going. */}
      {!ready && !disabled ? (
        <p className="text-xs text-muted-foreground">
          Awtomatiko ito — wala kang kailangang i-type.
        </p>
      ) : null}
    </div>
  )
}

"use client"

import { useActionState, useId, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Loader2, MailCheck, TriangleAlert } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { signUpWithPassword, type AuthActionState } from "@/features/auth/actions"

const INITIAL_STATE: AuthActionState = { status: "idle" }

export interface PasswordStrength {
  /** 0 = nothing typed, 1 = too short, 4 = strong. */
  score: 0 | 1 | 2 | 3 | 4
  label: string
}

/** A hint, not a gate — the server still enforces the 8-character minimum. */
export function passwordStrength(value: string): PasswordStrength {
  if (value.length === 0) return { score: 0, label: "" }
  if (value.length < 8) return { score: 1, label: "Too short — 8 characters minimum" }

  let points = 1
  if (value.length >= 12) points += 1
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) points += 1
  if (/\d/.test(value)) points += 1
  if (/[^A-Za-z0-9]/.test(value)) points += 1

  const score = Math.min(4, points) as 1 | 2 | 3 | 4
  const labels: Record<1 | 2 | 3 | 4, string> = {
    1: "Weak — mix in numbers or symbols",
    2: "Okay — a little more variety helps",
    3: "Good",
    4: "Malakas — nice one",
  }
  return { score, label: labels[score] }
}

const METER_TONES: Record<PasswordStrength["score"], string> = {
  0: "bg-muted",
  1: "bg-destructive",
  2: "bg-chart-2",
  3: "bg-chart-3",
  4: "bg-chart-3",
}

interface RegisterFormProps {
  nextPath?: string
}

export function RegisterForm({ nextPath = "/dashboard" }: RegisterFormProps) {
  const [state, formAction, pending] = useActionState(
    signUpWithPassword,
    INITIAL_STATE
  )
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [revealed, setRevealed] = useState(false)

  const nameId = useId()
  const emailId = useId()
  const passwordId = useId()
  const businessId = useId()

  if (state.status === "check-email") {
    return (
      <div className="space-y-6 text-center">
        <div className="space-y-3">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <MailCheck className="size-5" />
          </span>
          <div className="space-y-1">
            <h2 className="text-base font-medium text-balance">Check your inbox</h2>
            <p className="text-sm text-muted-foreground text-pretty">
              We sent a confirmation link to{" "}
              <span className="font-medium text-foreground">{state.email}</span>.
              Tap it and your raket is ready.
            </p>
          </div>
        </div>

        <Link
          href="/login"
          className="flex h-11 w-full items-center justify-center rounded-lg border border-border bg-background text-sm font-medium transition-colors hover:bg-muted"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined
  const nameError = fieldErrors?.fullName
  const emailError = fieldErrors?.email
  const passwordError = fieldErrors?.password
  const businessError = fieldErrors?.businessName
  const generalError =
    state.status === "error" && !fieldErrors ? state.message : undefined

  const strength = passwordStrength(password)

  return (
    <form action={formAction} noValidate className="space-y-6">
      <input type="hidden" name="next" value={nextPath} />

      {generalError ? (
        <Alert variant="destructive" className="p-3">
          <TriangleAlert />
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={nameId}>Full name</Label>
          <Input
            id={nameId}
            name="fullName"
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            placeholder="Juan dela Cruz"
            className="h-11"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${nameId}-error` : undefined}
          />
          {nameError ? (
            <p id={`${nameId}-error`} className="text-xs text-destructive">
              {nameError}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={emailId}>Email</Label>
          <Input
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="ikaw@raket.ph"
            className="h-11"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? `${emailId}-error` : undefined}
          />
          {emailError ? (
            <p id={`${emailId}-error`} className="text-xs text-destructive">
              {emailError}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={passwordId}>Password</Label>
          <div className="relative">
            <Input
              id={passwordId}
              name="password"
              type={revealed ? "text" : "password"}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="At least 8 characters"
              className="h-11 pr-12"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? `${passwordId}-error` : undefined}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-0 right-0 size-11 text-muted-foreground"
              aria-label={revealed ? "Hide password" : "Show password"}
              aria-pressed={revealed}
              onClick={() => setRevealed((value) => !value)}
            >
              {revealed ? <EyeOff /> : <Eye />}
            </Button>
          </div>

          {strength.score > 0 ? (
            <div className="space-y-1.5" aria-live="polite">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((step) => (
                  <span
                    key={step}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      step <= strength.score
                        ? METER_TONES[strength.score]
                        : "bg-muted"
                    )}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{strength.label}</p>
            </div>
          ) : null}

          {passwordError ? (
            <p id={`${passwordId}-error`} className="text-xs text-destructive">
              {passwordError}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={businessId}>
            Business name
            <span className="text-xs font-normal text-muted-foreground">
              optional
            </span>
          </Label>
          <Input
            id={businessId}
            name="businessName"
            type="text"
            autoComplete="organization"
            placeholder="Aling Nena's Bakeshop"
            className="h-11"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            aria-invalid={businessError ? true : undefined}
            aria-describedby={businessError ? `${businessId}-error` : undefined}
          />
          {businessError ? (
            <p id={`${businessId}-error`} className="text-xs text-destructive">
              {businessError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" />
              Creating your account
            </>
          ) : (
            "Create account"
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground text-pretty lg:text-left">
          May account ka na?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </form>
  )
}

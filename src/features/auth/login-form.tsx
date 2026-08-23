"use client"

import { useActionState, useId, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Loader2, TriangleAlert } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signInWithPassword, type AuthActionState } from "@/features/auth/actions"

const INITIAL_STATE: AuthActionState = { status: "idle" }

interface LoginFormProps {
  /** Where to land after a successful sign-in. Comes from the middleware. */
  nextPath?: string
  /** A message carried back from the OAuth callback, if any. */
  notice?: string
}

export function LoginForm({ nextPath = "/dashboard", notice }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(
    signInWithPassword,
    INITIAL_STATE
  )
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [revealed, setRevealed] = useState(false)

  const emailId = useId()
  const passwordId = useId()

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined
  const emailError = fieldErrors?.email
  const passwordError = fieldErrors?.password
  const generalError =
    state.status === "error" && !fieldErrors ? state.message : undefined

  return (
    <form action={formAction} noValidate className="space-y-6">
      <input type="hidden" name="next" value={nextPath} />

      {notice ? (
        <Alert variant="destructive" className="p-3">
          <TriangleAlert />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      {generalError ? (
        <Alert variant="destructive" className="p-3">
          <TriangleAlert />
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3">
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
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Your password"
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
          {passwordError ? (
            <p id={`${passwordId}-error`} className="text-xs text-destructive">
              {passwordError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" />
              Signing you in
            </>
          ) : (
            "Sign in"
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground text-pretty">
          Bago ka lang?{" "}
          <Link
            href="/register"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </form>
  )
}

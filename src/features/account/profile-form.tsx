"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateProfile, type ProfileFormState } from "@/features/account/actions"

const INITIAL_STATE: ProfileFormState = { status: "idle" }

export interface ProfileFormProps {
  email: string | null
  fullName: string | null
  businessName: string | null
  /** True when Supabase is unconfigured — the form is shown but cannot save. */
  readOnly?: boolean
}

export function ProfileForm({
  email,
  fullName,
  businessName,
  readOnly = false,
}: ProfileFormProps) {
  const [state, formAction, isPending] = React.useActionState(
    updateProfile,
    INITIAL_STATE
  )

  React.useEffect(() => {
    if (state.status === "success" && state.message) {
      toast.success(state.message)
    } else if (state.status === "error" && state.message) {
      toast.error(state.message)
    }
  }, [state])

  const nameError = state.fieldErrors?.fullName
  const businessError = state.fieldErrors?.businessName

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Your name</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          placeholder="Juan dela Cruz"
          className="h-11"
          defaultValue={state.values?.fullName ?? fullName ?? ""}
          disabled={readOnly}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "fullName-error" : undefined}
        />
        {nameError ? (
          <p id="fullName-error" className="text-sm text-destructive">
            {nameError}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="businessName">Business name</Label>
        <Input
          id="businessName"
          name="businessName"
          autoComplete="organization"
          placeholder="Aling Nena's Bakeshop"
          className="h-11"
          defaultValue={state.values?.businessName ?? businessName ?? ""}
          disabled={readOnly}
          aria-invalid={businessError ? true : undefined}
          aria-describedby={
            businessError ? "businessName-error" : "businessName-hint"
          }
        />
        {businessError ? (
          <p id="businessName-error" className="text-sm text-destructive">
            {businessError}
          </p>
        ) : (
          <p id="businessName-hint" className="text-xs text-muted-foreground">
            Optional. This is what your suki will see.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          className="h-11"
          value={email ?? ""}
          readOnly
          disabled
        />
        <p className="text-xs text-muted-foreground">
          Your sign-in email cannot be changed here yet.
        </p>
      </div>

      <Button
        type="submit"
        disabled={readOnly || isPending}
        className="h-11 w-full sm:w-auto sm:px-6"
      >
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  )
}

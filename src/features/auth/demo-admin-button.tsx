"use client"

import { useActionState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { signInAsDemoAdmin, type AuthActionState } from "@/features/auth/actions"

const INITIAL_STATE: AuthActionState = { status: "idle" }

interface DemoAdminButtonProps {
  nextPath?: string
}

export function DemoAdminButton({ nextPath = "/dashboard" }: DemoAdminButtonProps) {
  const [state, formAction, pending] = useActionState(
    signInAsDemoAdmin,
    INITIAL_STATE
  )

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border bg-muted/40 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium tracking-wide text-muted-foreground">
          Dev shortcut
        </span>
      </div>

      <p className="text-sm text-muted-foreground text-pretty">
        Skip the form and land in the dashboard as the seeded admin account.
      </p>

      <form action={formAction}>
        <input type="hidden" name="next" value={nextPath} />
        <Button
          type="submit"
          variant="secondary"
          className="h-11 w-full"
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="animate-spin" />
              Signing in as admin
            </>
          ) : (
            "Sign in as demo admin"
          )}
        </Button>
      </form>

      {state.status === "error" ? (
        <p role="alert" className="text-xs text-destructive text-pretty">
          {state.message}
        </p>
      ) : null}
    </div>
  )
}

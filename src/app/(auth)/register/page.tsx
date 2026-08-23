import type { Metadata } from "next"
import { Info } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { AuthShell } from "@/features/auth/auth-shell"
import { firstParam, safeNextPath } from "@/features/auth/guards"
import { OAuthButtons } from "@/features/auth/oauth-buttons"
import { RegisterForm } from "@/features/auth/register-form"
import { supabaseConfigured } from "@/lib/env"

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Start free on RaketShip, then add only the modules your raket actually needs.",
}

type SearchParams = Record<string, string | string[] | undefined>

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const nextPath = safeNextPath(firstParam(params.next))

  return (
    <AuthShell
      title="Simulan ang raket"
      subtitle="Free to start. Add modules one notch at a time, tingi style."
    >
      <div className="space-y-6">
        {!supabaseConfigured ? (
          <Alert className="p-3">
            <Info />
            <AlertTitle>Finish setup first</AlertTitle>
            <AlertDescription>
              Add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local and restart the
              dev server before creating an account.
            </AlertDescription>
          </Alert>
        ) : null}

        <RegisterForm nextPath={nextPath} />

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        <OAuthButtons next={nextPath} />
      </div>
    </AuthShell>
  )
}

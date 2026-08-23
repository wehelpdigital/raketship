import type { Metadata } from "next"
import { Info } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { AuthShell } from "@/features/auth/auth-shell"
import { DemoAdminButton } from "@/features/auth/demo-admin-button"
import {
  demoLoginVisible,
  firstParam,
  safeNextPath,
  tidyNotice,
} from "@/features/auth/guards"
import { LoginForm } from "@/features/auth/login-form"
import { OAuthButtons } from "@/features/auth/oauth-buttons"
import { supabaseConfigured } from "@/lib/env"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to RaketShip and keep building your raket.",
}

type SearchParams = Record<string, string | string[] | undefined>

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const nextPath = safeNextPath(firstParam(params.next))
  const notice = tidyNotice(params.error)

  return (
    <AuthShell
      title="Welcome back, suki"
      subtitle="Sign in to pick up where your raket left off."
      footer={demoLoginVisible() ? <DemoAdminButton nextPath={nextPath} /> : null}
    >
      <div className="space-y-6">
        {!supabaseConfigured ? (
          <Alert className="p-3">
            <Info />
            <AlertTitle>Finish setup first</AlertTitle>
            <AlertDescription>
              Add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local and restart the
              dev server. Until then, sign-in stays parked.
            </AlertDescription>
          </Alert>
        ) : null}

        <LoginForm nextPath={nextPath} notice={notice} />

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

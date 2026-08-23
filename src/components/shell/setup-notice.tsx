import { Wrench } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { supabaseConfigured } from "@/lib/env"
import { cn } from "@/lib/utils"

export type SetupReason = "unconfigured" | "no-data"

export interface SetupNoticeProps {
  /** Defaults to whichever step is actually missing. */
  reason?: SetupReason
  className?: string
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
        {n}
      </span>
      <span className="min-w-0 text-pretty">{children}</span>
    </li>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs break-all text-foreground">
      {children}
    </code>
  )
}

export function SetupNotice({ reason, className }: SetupNoticeProps) {
  const resolved: SetupReason =
    reason ?? (supabaseConfigured ? "no-data" : "unconfigured")

  return (
    <Alert className={cn("rounded-xl p-4 sm:p-5", className)}>
      <Wrench aria-hidden="true" />
      <AlertTitle>
        {resolved === "unconfigured"
          ? "Almost there — connect your database"
          : "Your database is connected, but still empty"}
      </AlertTitle>
      {/* The base description styles give a leading <p> mb-4, which would
          fight space-y-3 and break the page's rhythm. */}
      <AlertDescription className="space-y-3 [&_p:not(:last-child)]:mb-0">
        <p className="text-pretty">
          {resolved === "unconfigured"
            ? "RaketShip runs fine like this, you just won't see real data yet. Three short steps and you're in."
            : "The tables or the seed data have not landed yet. Run these and refresh."}
        </p>
        <ol className="space-y-3 text-sm">
          <Step n={1}>
            Put your Supabase URL and publishable key in{" "}
            <Code>.env.local</Code> as <Code>NEXT_PUBLIC_SUPABASE_URL</Code> and{" "}
            <Code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</Code>.
          </Step>
          <Step n={2}>
            Run <Code>npm run db:push</Code> — or paste{" "}
            <Code>supabase/setup.sql</Code> into the Supabase SQL editor and hit
            run.
          </Step>
          <Step n={3}>
            Run <Code>npm run db:seed-admin</Code> to create the first account,
            then sign in.
          </Step>
        </ol>
      </AlertDescription>
    </Alert>
  )
}

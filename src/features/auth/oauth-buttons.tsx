"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { supabaseConfigured } from "@/lib/env"
import { requireSupabaseBrowserClient } from "@/lib/supabase/client"

/**
 * Google's mark is a trademark, so its four brand colours are hard-coded here
 * on purpose — this is the one place the token palette does not apply.
 */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.26v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.26a12 12 0 0 0 0 10.76l4.02-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.2 15.24 0 12 0A12 12 0 0 0 1.26 6.62l4.02 3.1C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  )
}

interface OAuthButtonsProps {
  /** Path to land on once the provider bounces back through /auth/callback. */
  next?: string
}

export function GoogleSignInButton({ next = "/dashboard" }: OAuthButtonsProps) {
  const [pending, setPending] = useState(false)

  async function handleClick() {
    if (!supabaseConfigured) {
      toast.error("Supabase isn't connected yet.", {
        description:
          "Add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart the dev server.",
      })
      return
    }

    setPending(true)
    try {
      const supabase = requireSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })

      if (error) {
        const message = error.message.toLowerCase()
        if (
          message.includes("provider is not enabled") ||
          message.includes("unsupported provider")
        ) {
          toast.error("Google sign-in isn't switched on for this project yet.", {
            description: "Use your email and password for now.",
          })
        } else {
          toast.error("Couldn't start Google sign-in.", {
            description: error.message,
          })
        }
        setPending(false)
        return
      }

      // On success the browser is already leaving for Google — keep the
      // spinner up so the button never looks idle mid-navigation.
    } catch {
      toast.error("Couldn't start Google sign-in.", {
        description: "Check your Supabase settings and try again.",
      })
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full"
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin" />
          Opening Google
        </>
      ) : (
        <>
          <GoogleMark className="size-4" />
          Continue with Google
        </>
      )}
    </Button>
  )
}

export function OAuthButtons({ next = "/dashboard" }: OAuthButtonsProps) {
  return (
    <div className="space-y-3">
      <GoogleSignInButton next={next} />
    </div>
  )
}

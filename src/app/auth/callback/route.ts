import { NextResponse, type NextRequest } from "next/server"

import { safeNextPath } from "@/features/auth/guards"
import { getSupabaseServerClient } from "@/lib/supabase/server"

/** Behind a proxy the request URL host is the internal one — trust the header. */
function originFor(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")
  if (process.env.NODE_ENV === "production" && forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https"
    return `${proto}://${forwardedHost}`
  }
  return request.nextUrl.origin
}

function friendly(raw: string) {
  const message = raw.toLowerCase()
  if (message.includes("provider is not enabled") || message.includes("unsupported provider")) {
    return "That sign-in option isn't switched on for this project yet."
  }
  if (message.includes("access_denied") || message.includes("cancel")) {
    return "That sign-in was cancelled. No harm done — try again."
  }
  if (message.includes("expired") || message.includes("invalid request")) {
    return "That sign-in link has expired. Please try again."
  }
  return raw
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const origin = originFor(request)
  const next = safeNextPath(searchParams.get("next"))

  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`)

  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error")
  if (providerError) {
    return fail(friendly(providerError))
  }

  const code = searchParams.get("code")
  if (!code) {
    return fail("That sign-in link was incomplete. Please try again.")
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return fail(
      "Supabase isn't connected yet. Add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local."
    )
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return fail(friendly(error.message))
  }

  return NextResponse.redirect(`${origin}${next}`)
}

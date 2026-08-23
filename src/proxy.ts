import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

import { env, supabaseConfigured } from "@/lib/env"

/** Routes that require a signed-in user. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/raket",
  "/marketplace",
  "/account",
]

/** Routes a signed-in user should be bounced away from. */
const AUTH_ROUTES = ["/login", "/register"]

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Without credentials we cannot judge the session — let the page render its
  // own "finish setup" state rather than bouncing the user around.
  if (!supabaseConfigured) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    env.supabaseUrl,
    env.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() revalidates against Supabase — do not swap this for getSession(),
  // which trusts whatever the cookie claims.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && isProtected(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets. Keeping images out
     * of the matcher matters on mobile, where every skipped round-trip counts.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
}

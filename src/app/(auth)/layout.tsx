import type { ReactNode } from "react"

import { AuthBrandPanel, AuthHighlights } from "@/features/auth/auth-shell"

export default function AuthLayout({ children }: { children: ReactNode }) {
  // Phone: one centred card. Tablet: the same card plus a three-up value strip,
  // so 834px is not a phone screen with 200px of margin either side. From `lg`
  // the screen splits — brand panel on the left, form column on the right, each
  // half full-height, and the strip stands down because the panel says it
  // better. overflow-hidden keeps every decorative blur inside the viewport so
  // none of them ever invents a scrollbar.
  return (
    <main className="grid min-h-dvh overflow-hidden lg:grid-cols-2 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <AuthBrandPanel />
      <div className="flex flex-col items-center justify-center gap-8 px-4 py-6 sm:px-6 md:gap-10 md:py-12 lg:px-10 xl:px-14">
        {children}
        <AuthHighlights />
      </div>
    </main>
  )
}

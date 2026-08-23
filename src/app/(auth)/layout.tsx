import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  // overflow-hidden keeps the shell's decorative blur inside the viewport so it
  // never invents a scrollbar on a short phone screen.
  return (
    <main className="grid min-h-dvh place-items-center overflow-hidden px-4 py-6 sm:px-6">
      {children}
    </main>
  )
}

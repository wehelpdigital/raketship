import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { LocaleProvider } from "@/components/shell/locale-provider"
import { RouteTransition } from "@/components/shell/route-transition"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { getLocale } from "@/lib/i18n/server"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "RaketShip — Build your raket",
    template: "%s · RaketShip",
  },
  description:
    "The tingi-style business toolkit for Filipino raketeros. Start free, then add only the modules your business actually needs.",
  applicationName: "RaketShip",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
  appleWebApp: {
    capable: true,
    title: "RaketShip",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Cover the notch so our pb-safe / pt-safe utilities have room to work.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#170c0b" },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /*
    The language is read here, once, on the server. Everything below is told
    rather than asked: a client component that read the cookie itself would
    render the default first and correct itself after hydration, which is a
    flash of the wrong language on every single page.
  */
  const locale = await getLocale()

  // Next 16 stopped forcing scroll-to-top on navigation; the data attribute
  // opts back in, which matters because globals.css sets scroll-behavior: smooth.
  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans`}
      >
        <LocaleProvider locale={locale}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <RouteTransition />
            {children}
            <Toaster position="top-center" richColors closeButton />
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}

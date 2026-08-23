"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const noopSubscribe = () => () => {}
const onClient = () => true
const onServer = () => false

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = React.useSyncExternalStore(
    noopSubscribe,
    onClient,
    onServer
  )

  // The server cannot know which theme the browser resolved, so hold the space
  // until hydration and swap the icon in afterwards.
  if (!mounted) {
    return <div aria-hidden="true" className={cn("size-11 shrink-0", className)} />
  }

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn("size-11 shrink-0 rounded-lg", className)}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <Moon className="size-5" aria-hidden="true" />
      ) : (
        <Sun className="size-5" aria-hidden="true" />
      )}
    </Button>
  )
}

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The spacing contract for every screen: one gutter, one rhythm, and enough
 * bottom padding that the mobile tab bar never sits on top of content.
 */
export function PageContainer({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-container"
      className={cn(
        "mx-auto w-full max-w-2xl space-y-6 px-4 py-6 pb-24 sm:px-6 md:max-w-3xl md:pb-6 lg:max-w-5xl lg:space-y-8 lg:px-8 lg:py-8 xl:max-w-6xl",
        className
      )}
      {...props}
    />
  )
}

export interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn("flex items-start justify-between gap-3", className)}
    >
      <div className="min-w-0 space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl lg:text-3xl">
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export interface SectionHeadingProps {
  title: React.ReactNode
  action?: React.ReactNode
  className?: string
}

/** Section label inside a page — smaller than PageHeader, same rhythm. */
export function SectionHeading({
  title,
  action,
  className,
}: SectionHeadingProps) {
  return (
    <div
      data-slot="section-heading"
      className={cn("flex items-center justify-between gap-3", className)}
    >
      <h2 className="text-sm font-semibold tracking-tight lg:text-base">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

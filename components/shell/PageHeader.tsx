import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type PageHeaderProps = {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
  badges?: ReactNode
  className?: string
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  badges,
  className,
}: PageHeaderProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden",
        className,
      )}
    >
      {/* Decorative background elements */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-accent/30"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/5 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-primary/20 via-primary/10 to-transparent"
      />

      <CardContent className="relative grid gap-4 p-4 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-4xl space-y-2">
            <Badge
              variant="outline"
              className="w-fit"
            >
              {eyebrow}
            </Badge>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em] text-balance md:text-3xl">
                {title}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        {badges ? <div className="flex flex-wrap gap-2">{badges}</div> : null}
      </CardContent>
    </Card>
  )
}

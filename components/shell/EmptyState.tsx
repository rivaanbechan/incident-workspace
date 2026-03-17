import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type EmptyStateProps = {
  /** Optional action buttons or supplementary content rendered below the message. */
  children?: ReactNode
  /** Optional heading rendered above the message (requires `icon` or stands alone). */
  heading?: ReactNode
  /** Optional icon rendered in a circle above the heading. Triggers centered layout. */
  icon?: ReactNode
  message: ReactNode
  /**
   * "sm" for compact inline placeholders.
   * "md" (default) for panel-level empty states.
   * "lg" for full-page hero empty states.
   */
  size?: "sm" | "md" | "lg"
}

/**
 * EmptyState — dashed-border card used wherever a list or panel has no items yet.
 * Pass `icon` and/or `heading` to render the centred icon-hero variant.
 */
export function EmptyState({ children, heading, icon, message, size = "md" }: EmptyStateProps) {
  if (icon || heading) {
    return (
      <Card className="border-dashed border-border/60 bg-card shadow-none">
        <CardContent
          className={cn(
            "flex flex-col items-center justify-center text-center",
            size === "sm" && "gap-1.5 p-4 text-xs",
            size === "md" && "gap-2 p-5 text-sm",
            size === "lg" && "gap-2 py-16 text-sm",
          )}
        >
          {icon ? (
            <div
              className={cn(
                "mb-1 inline-flex items-center justify-center rounded-full bg-muted",
                size === "sm" ? "size-8" : size === "lg" ? "size-12" : "size-10",
              )}
            >
              {icon}
            </div>
          ) : null}
          {heading ? (
            <p
              className={cn(
                "font-medium text-foreground",
                size === "lg" ? "text-lg" : "text-sm",
              )}
            >
              {heading}
            </p>
          ) : null}
          <p className="text-muted-foreground">{message}</p>
          {children}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-dashed border-border/60 bg-card shadow-none">
      <CardContent
        className={cn(
          "text-muted-foreground",
          size === "sm" ? "p-3 text-xs leading-5" : "grid gap-4 p-5 text-sm leading-6",
        )}
      >
        <p>{message}</p>
        {children}
      </CardContent>
    </Card>
  )
}

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type SelectableCardProps = {
  children: ReactNode
  isSelected: boolean
  onClick: () => void
  /** "lg" — rounded-3xl p-5 (vendor picker cards). "sm" — rounded-2xl p-4 (instance list cards). */
  size?: "sm" | "lg"
  className?: string
}

/**
 * SelectableCard — a clickable card button with selected/unselected border states.
 * Used for the vendor picker and instance picker in DatasourceAdminPanel.
 */
export function SelectableCard({
  children,
  isSelected,
  onClick,
  size = "sm",
  className,
}: SelectableCardProps) {
  return (
    <button
      className={cn(
        "w-full border bg-card text-left transition-all duration-150",
        size === "lg"
          ? "rounded-2xl p-5 hover:shadow-md"
          : "rounded-xl p-4 hover:bg-muted/50",
        isSelected
          ? size === "lg"
            ? "border-primary/60 shadow-sm ring-1 ring-primary/20 bg-card"
            : "border-primary/50 bg-muted/40 ring-1 ring-primary/15"
          : size === "lg"
            ? "border-border/60 hover:border-border"
            : "border-border/50 hover:border-border/80",
        className,
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

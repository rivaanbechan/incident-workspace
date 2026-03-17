import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type SelectableCardProps = {
  children: ReactNode
  isSelected: boolean
  onClick: () => void
  /** "lg" — rounded-3xl p-6 with shadow (vendor picker cards). "sm" — rounded-2xl p-4 (instance list cards). */
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
        "border bg-card text-left transition",
        size === "lg"
          ? "rounded-3xl p-6 shadow-sm hover:border-primary/30 hover:bg-muted/80"
          : "rounded-2xl p-4 hover:border-primary/20",
        isSelected
          ? size === "lg"
            ? "border-primary/40 bg-gradient-to-b from-card to-muted"
            : "border-primary/40 bg-muted"
          : "border-border/70" + (size === "sm" ? " bg-card" : ""),
        className,
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

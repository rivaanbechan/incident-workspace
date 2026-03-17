import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type MiniStatGridProps = {
  stats: { label: string; value: ReactNode }[]
  /** Number of columns. Defaults to the number of stats. */
  cols?: number
  /** Extra classes applied to each cell (e.g. different bg or padding). */
  cellClassName?: string
  /** Extra classes applied to the value element. */
  valueClassName?: string
}

/**
 * MiniStatGrid — a compact grid of label + value cells.
 * Used inside cards to surface entity-level counts at a glance.
 */
export function MiniStatGrid({
  stats,
  cols,
  cellClassName,
  valueClassName,
}: MiniStatGridProps) {
  const colCount = cols ?? stats.length

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={cn("rounded-xl bg-card px-2.5 py-2", cellClassName)}
        >
          <div className="text-[10px] font-bold uppercase text-muted-foreground">{stat.label}</div>
          <div className={cn("font-bold text-foreground", valueClassName ?? "text-base")}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  )
}

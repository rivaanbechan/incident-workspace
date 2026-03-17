import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type StatCardVariant = "default" | "primary" | "destructive" | "success"

const VARIANT_STYLES: Record<
  StatCardVariant,
  { bar: string; iconBox: string }
> = {
  default: {
    bar: "bg-border/60",
    iconBox: "border-border/50 bg-background/80 text-muted-foreground",
  },
  primary: {
    bar: "bg-primary/60",
    iconBox: "border-primary/20 bg-primary/10 text-primary",
  },
  destructive: {
    bar: "bg-destructive/60",
    iconBox: "border-destructive/20 bg-destructive/10 text-destructive",
  },
  success: {
    bar: "bg-success/60",
    iconBox: "border-success/20 bg-success/10 text-success",
  },
}

type StatCardProps = {
  icon: ReactNode
  label: string
  value: ReactNode
  variant?: StatCardVariant
}

/**
 * StatCard — metric overview card with a coloured accent bar and icon box.
 * Used in index/overview pages to surface key numbers at a glance.
 */
export function StatCard({ icon, label, value, variant = "default" }: StatCardProps) {
  const styles = VARIANT_STYLES[variant]
  return (
    <Card className="relative overflow-hidden border-border/50 bg-card/95 shadow-sm">
      <div className={cn("absolute inset-x-0 top-0 h-px", styles.bar)} />
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </div>
          <div className="text-3xl font-bold tracking-tight text-foreground">{value}</div>
        </div>
        <div className={cn("rounded-2xl border p-3", styles.iconBox)}>{icon}</div>
      </CardContent>
    </Card>
  )
}

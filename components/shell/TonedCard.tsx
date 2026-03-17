import type { ComponentPropsWithoutRef } from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type TonedCardProps = ComponentPropsWithoutRef<typeof Card> & {
  /**
   * The tint colour for the radial gradient (e.g. "rgba(185, 28, 28, 0.14)").
   * Drives the `circle at top left` highlight effect.
   */
  tint: string
  /**
   * Optional accent colour for the 4px bar pinned to the top of the card.
   * Pass the hex/css colour directly.
   */
  accent?: string
}

/**
 * TonedCard — a `Card` with a coloured radial-gradient background tint and an
 * optional top accent bar. Used for any card whose colour communicates status
 * or severity (investigation cards, action cards, timeline entries).
 */
export function TonedCard({
  tint,
  accent,
  className,
  children,
  style,
  ...props
}: TonedCardProps) {
  return (
    <Card
      className={cn("relative overflow-hidden", className)}
      style={{
        backgroundImage: `linear-gradient(180deg, hsl(var(--card) / 0.98), hsl(var(--card) / 0.94)), radial-gradient(circle at top left, ${tint}, transparent 65%)`,
        ...style,
      }}
      {...props}
    >
      {accent ? (
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
      ) : null}
      {children}
    </Card>
  )
}

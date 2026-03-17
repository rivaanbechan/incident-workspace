import type { ReactNode } from "react"
import { TonedCard } from "@/components/shell/TonedCard"

type TimelineEntryProps = {
  /** Content rendered inside the TonedCard. */
  children: ReactNode
  /** Formatted day string (e.g. "Mon, 17 March"). Controls day-header visibility. */
  currentDay: string
  /** The formatted day of the previous entry — pass null for the first entry. */
  previousDay: string | null
  /** Timestamp line (primary) shown in the left column. */
  timestampLabel: ReactNode
  /** Secondary label shown below the timestamp (author, source, etc.). */
  secondaryLabel: ReactNode
  /** Tone accent/tint used for the timeline dot and TonedCard background. */
  tone: { accent: string; tint: string }
}

/**
 * TimelineEntry — shared [timestamp | dot | TonedCard] scaffold.
 * Used in IncidentTimelineBoard and CaseDetailPage case timeline.
 */
export function TimelineEntry({
  children,
  currentDay,
  previousDay,
  timestampLabel,
  secondaryLabel,
  tone,
}: TimelineEntryProps) {
  const showDayHeader = currentDay !== previousDay

  return (
    <div className="grid gap-3">
      {showDayHeader ? (
        <div className="flex items-center gap-3 pt-1">
          <div className="min-w-24 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {currentDay}
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-border/40 to-border/0" />
        </div>
      ) : null}

      <article className="grid gap-3 sm:grid-cols-[72px_24px_minmax(0,1fr)]">
        <div className="grid content-start justify-items-start gap-1 pt-1 sm:justify-items-end">
          <div className="text-sm font-bold text-foreground">{timestampLabel}</div>
          <div className="text-xs font-medium text-muted-foreground">{secondaryLabel}</div>
        </div>

        <div className="relative hidden min-h-24 justify-center sm:flex">
          <div className="absolute bottom-0 top-0 w-px bg-gradient-to-b from-border/10 via-border/40 to-border/10" />
          <div
            className="relative z-10 mt-2 size-3 rounded-full"
            style={{
              background: tone.accent,
              boxShadow: `0 0 0 4px ${tone.tint}`,
            }}
          />
        </div>

        <TonedCard tint={tone.tint} className="border-border/50 bg-card/92 shadow-sm">
          {children}
        </TonedCard>
      </article>
    </div>
  )
}

"use client"

import type { UseHuntGraphTimelineReturn } from "@/features/collab-hunt-graph/hooks/useHuntGraphTimeline"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type HuntGraphTimelineScrubberProps = {
  timeline: UseHuntGraphTimelineReturn
}

function formatTs(ts: number): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ts))
}

export function HuntGraphTimelineScrubber({ timeline }: HuntGraphTimelineScrubberProps) {
  const {
    availableTimeRange,
    hasTimeData,
    isPlaying,
    pause,
    play,
    scrubberValue,
    setScrubberValue,
    visibleUpTo,
  } = timeline

  return (
    <Card className="border-border/60 bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Timeline Replay</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!hasTimeData && (
          <p className="text-sm text-muted-foreground">
            Select a <span className="font-medium text-foreground">Time field</span> in the
            column mapping above, then rebuild the graph to enable timeline replay.
          </p>
        )}
        {hasTimeData && (
          <>
            <div className="flex items-center gap-3">
              <Button
                onClick={isPlaying ? pause : play}
                size="sm"
                type="button"
                variant={isPlaying ? "default" : "outline"}
              >
                {isPlaying ? "Pause" : "Play"}
              </Button>
              <Button
                onClick={() => setScrubberValue(100)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Reset
              </Button>
            </div>

            <input
              className="w-full accent-primary"
              max={100}
              min={0}
              onChange={(e) => setScrubberValue(Number(e.target.value))}
              step={1}
              type="range"
              value={scrubberValue}
            />

            <div className="flex justify-between text-xs text-muted-foreground">
              {availableTimeRange && (
                <>
                  <span>{formatTs(availableTimeRange.min)}</span>
                  <span>{formatTs(availableTimeRange.max)}</span>
                </>
              )}
            </div>

            {visibleUpTo !== null && (
              <div className="text-xs font-medium text-foreground">
                Showing up to: {formatTs(visibleUpTo)}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

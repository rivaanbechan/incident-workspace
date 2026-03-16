"use client"

import { useEffect, useRef } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { IncidentLogEntry } from "@/features/incident-workspace/lib/board/types"
import { cn } from "@/lib/utils"

type QuickCaptureMode = "action" | "timeline"

type QuickCapturePaletteProps = {
  draft: string
  isOpen: boolean
  mode: QuickCaptureMode
  onClose: () => void
  onDraftChange: (value: string) => void
  onModeChange: (mode: QuickCaptureMode) => void
  onSubmit: () => void
  onTimelineTypeChange: (value: IncidentLogEntry["type"]) => void
  timelineType: IncidentLogEntry["type"]
}

const TIMELINE_TYPES: IncidentLogEntry["type"][] = [
  "update",
  "decision",
  "mitigation",
  "owner_change",
  "comms",
]

const TIMELINE_LABELS: Record<IncidentLogEntry["type"], string> = {
  comms: "Comms",
  decision: "Decision",
  mitigation: "Mitigation",
  owner_change: "Owner Change",
  update: "Update",
}

function cycleTimelineType(
  current: IncidentLogEntry["type"],
  direction: 1 | -1,
): IncidentLogEntry["type"] {
  const currentIndex = TIMELINE_TYPES.indexOf(current)
  const nextIndex =
    currentIndex === -1
      ? 0
      : (currentIndex + direction + TIMELINE_TYPES.length) % TIMELINE_TYPES.length

  return TIMELINE_TYPES[nextIndex] ?? "update"
}

export function QuickCapturePalette({
  draft,
  isOpen,
  mode,
  onClose,
  onDraftChange,
  onModeChange,
  onSubmit,
  onTimelineTypeChange,
  timelineType,
}: QuickCapturePaletteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center p-4">
      <Card
        className="pointer-events-auto w-full max-w-2xl border-border bg-background/95 text-foreground shadow-2xl shadow-background/30 backdrop-blur"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault()
            onClose()
            return
          }

          if (event.key === "Enter") {
            event.preventDefault()
            onSubmit()
            return
          }

          if (event.key === "Tab") {
            event.preventDefault()
            onModeChange(mode === "timeline" ? "action" : "timeline")
            return
          }

          if (mode === "timeline" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
            event.preventDefault()
            onTimelineTypeChange(
              cycleTimelineType(timelineType, event.key === "ArrowRight" ? 1 : -1),
            )
          }
        }}
      >
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardDescription className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Quick Capture
              </CardDescription>
              <CardTitle className="mt-2 text-xl text-foreground">
                Keyboard-first room entry
              </CardTitle>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["timeline", "action"] as const).map((item) => {
                const isActive = item === mode

                return (
                  <Button
                    key={item}
                    className={cn(
                      isActive
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted text-foreground hover:bg-muted/80",
                    )}
                    onClick={() => onModeChange(item)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {item === "timeline" ? "Timeline" : "Action"}
                  </Button>
                )
              })}
            </div>
          </div>

          {mode === "timeline" ? (
            <div className="flex flex-wrap gap-2">
              {TIMELINE_TYPES.map((item) => (
                <Badge
                  key={item}
                  className={cn(
                    "cursor-pointer border-0 px-3 py-1.5",
                    item === timelineType
                      ? "bg-info/20 text-info"
                      : "bg-muted text-muted-foreground",
                  )}
                  onClick={() => onTimelineTypeChange(item)}
                >
                  {TIMELINE_LABELS[item]}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">
              {mode === "timeline"
                ? "What should be added to the timeline?"
                : "What action should be created?"}
            </label>
            <Input
              className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder={
                mode === "timeline"
                  ? "Containment confirmed on web-02"
                  : "Investigate suspicious access on web-02"
              }
              ref={inputRef}
              value={draft}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs leading-5 text-muted-foreground">
            <div>
              {mode === "timeline"
                ? "Tab switches mode. Left/right changes category. Enter submits."
                : "Tab switches mode. Enter submits. Esc closes."}
            </div>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={onSubmit}
              type="button"
            >
              {mode === "timeline" ? "Add Timeline Entry" : "Create Action"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

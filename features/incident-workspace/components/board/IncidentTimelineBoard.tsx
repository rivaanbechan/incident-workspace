"use client"

import { EmptyState } from "@/components/shell/EmptyState"
import { TimelineEntry } from "@/components/shell/TimelineEntry"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { formatLogTimestamp } from "@/features/incident-workspace/components/board/boardCore"
import type { IncidentLogEntry } from "@/features/incident-workspace/lib/board/types"
import { cn } from "@/lib/utils"
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react"

type TimelineFilter = "all" | IncidentLogEntry["type"]

type IncidentTimelineBoardProps = {
  draft: string
  entries: IncidentLogEntry[]
  entryType: IncidentLogEntry["type"]
  onAddEntry: () => void
  onCreateActionFromEntry: (entryId: string) => void
  onDeleteEntry: (entryId: string) => void
  onDraftChange: (value: string) => void
  onEntryTypeChange: (value: IncidentLogEntry["type"]) => void
  onOpenActionBoard: () => void
  onPromoteEntry?: (entry: IncidentLogEntry) => void
  onSelectEntity: (entityId: string) => void
  onSeedFromSelection?: () => void
  isVisualMode?: boolean
  onEnterInsertMode?: () => void
  onExitToVisualMode?: () => void
  composerRef?: MutableRefObject<HTMLTextAreaElement | null>
  selectedEntityLabel?: string | null
  getActionLabel: (actionId: string) => string
  getEntityLabel: (entityId: string) => string
}

const TIMELINE_TYPE_LABELS: Record<IncidentLogEntry["type"], string> = {
  comms: "Comms",
  decision: "Decision",
  mitigation: "Mitigation",
  owner_change: "Owner change",
  update: "Update",
}

const TIMELINE_TYPE_ORDER: IncidentLogEntry["type"][] = [
  "update",
  "mitigation",
  "decision",
  "owner_change",
  "comms",
]

const TIMELINE_TONES: Record<
  IncidentLogEntry["type"],
  { accent: string; badge: "info" | "success" | "secondary" | "warning" | "muted"; tint: string }
> = {
  comms: {
    accent: "#7c3aed",
    badge: "secondary",
    tint: "rgba(124, 58, 237, 0.14)",
  },
  decision: {
    accent: "#2563eb",
    badge: "info",
    tint: "rgba(37, 99, 235, 0.14)",
  },
  mitigation: {
    accent: "#16a34a",
    badge: "success",
    tint: "rgba(22, 163, 74, 0.14)",
  },
  owner_change: {
    accent: "#d97706",
    badge: "warning",
    tint: "rgba(217, 119, 6, 0.14)",
  },
  update: {
    accent: "hsl(var(--muted-foreground))",
    badge: "muted",
    tint: "hsl(var(--muted) / 0.55)",
  },
}

const COMPOSER_TEMPLATES: Record<IncidentLogEntry["type"], string> = {
  comms: "Audience:\nMessage sent:\nNext comms checkpoint:",
  decision: "Decision:\nWhy now:\nReview point:",
  mitigation: "Mitigation step:\nOwner:\nExpected result:",
  owner_change: "Owner change:\nReason:\nNew owner:",
  update: "Signal:\nImpact:\nNext check:",
}

function formatTimelineDay(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "long",
    weekday: "short",
  }).format(new Date(value))
}

export function IncidentTimelineBoard({
  draft,
  entries,
  entryType,
  onAddEntry,
  onCreateActionFromEntry,
  onDeleteEntry,
  onDraftChange,
  onEntryTypeChange,
  onOpenActionBoard,
  onPromoteEntry,
  onSelectEntity,
  onSeedFromSelection,
  isVisualMode = false,
  onEnterInsertMode,
  onExitToVisualMode,
  composerRef,
  selectedEntityLabel,
  getActionLabel,
  getEntityLabel,
}: IncidentTimelineBoardProps) {
  const [filter, setFilter] = useState<TimelineFilter>("all")
  const sectionRef = useRef<HTMLElement | null>(null)
  const quickEntryRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (isVisualMode) {
        sectionRef.current?.focus()
        return
      }

      composerRef?.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [composerRef, isVisualMode])

  const filteredEntries = useMemo(() => {
    const nextEntries =
      filter === "all" ? entries : entries.filter((entry) => entry.type === filter)

    return nextEntries.slice().sort((left, right) => right.createdAt - left.createdAt)
  }, [entries, filter])

  const latestEntry = filteredEntries[0] ?? entries[entries.length - 1] ?? null

  const stats = [
    { label: "All events", value: entries.length.toString() },
    {
      label: "Decisions",
      value: entries.filter((entry) => entry.type === "decision").length.toString(),
    },
    {
      label: "Mitigations",
      value: entries.filter((entry) => entry.type === "mitigation").length.toString(),
    },
    {
      label: "Comms",
      value: entries.filter((entry) => entry.type === "comms").length.toString(),
    },
  ]

  return (
    <section
      ref={sectionRef}
      className="relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-[20px] bg-background/35 outline-none"
      style={{
        border: isVisualMode
          ? "4px solid hsl(var(--foreground) / 0.92)"
          : "1px solid hsl(var(--border) / 0.4)",
        boxSizing: "border-box",
        outline: isVisualMode ? "3px solid hsl(var(--primary) / 0.65)" : "none",
        outlineOffset: isVisualMode ? 3 : 0,
        boxShadow: isVisualMode
          ? "0 0 0 1px hsl(var(--background)), 0 0 28px hsl(var(--primary) / 0.22)"
          : "none",
      }}
      onKeyDown={(event) => {
        if (isVisualMode && event.key === "Enter" && event.target === sectionRef.current) {
          event.preventDefault()
          onEnterInsertMode?.()
          window.requestAnimationFrame(() => {
            composerRef?.current?.focus()
          })
          return
        }

        if (event.key === "Tab" && !event.shiftKey && event.target === sectionRef.current) {
          event.preventDefault()
          quickEntryRef.current?.focus()
        }
      }}
      onPointerDownCapture={(event) => {
        if (!isVisualMode) {
          return
        }

        event.preventDefault()
        onEnterInsertMode?.()
        window.requestAnimationFrame(() => {
          composerRef?.current?.focus()
        })
      }}
      tabIndex={0}
    >
      {isVisualMode ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[52px] rounded-t-[20px]"
          style={{
            borderBottom: "1px solid hsl(var(--primary) / 0.28)",
            background:
              "linear-gradient(180deg, hsl(var(--primary) / 0.2) 0%, hsl(var(--primary) / 0.08) 52%, transparent 100%)",
          }}
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0 z-20 rounded-[20px] transition-shadow duration-150"
        style={{
          boxShadow: isVisualMode
            ? "inset 0 0 0 2px hsl(var(--background)), inset 0 0 0 7px hsl(var(--primary) / 0.12)"
            : "none",
        }}
      />
      <Card className="rounded-b-none border-x-0 border-t-0 border-border/30 bg-card/90 shadow-none">
        <CardHeader className="gap-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Chronological incident history</CardTitle>
              <CardDescription className="mt-1">
                Review the full stream of timeline events with quick type filters and follow-up actions.
              </CardDescription>
            </div>
            {latestEntry ? (
              <Card className="min-w-[220px] border-border/50 bg-background/75 shadow-none">
                <CardContent className="p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Latest event
                  </div>
                  <div className="mt-2 text-sm font-semibold text-foreground">
                    {TIMELINE_TYPE_LABELS[latestEntry.type]} · {formatLogTimestamp(latestEntry.createdAt)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{latestEntry.authorName}</div>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="border-border/50 bg-background/75 shadow-none">
                <CardContent className="p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {stat.label}
                  </div>
                  <div className="mt-2 text-2xl font-bold text-foreground">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardHeader>
      </Card>

      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 bg-gradient-to-b from-card/70 via-background/70 to-muted/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-foreground">Filter the main feed</div>
          <div className="flex flex-wrap gap-2">
            {[{ id: "all", label: "All" }, ...Object.entries(TIMELINE_TYPE_LABELS).map(([id, label]) => ({ id, label }))].map(
              (item) => {
                const isActive = filter === item.id

                return (
                  <Button
                    key={item.id}
                    className="rounded-full"
                    onClick={() => setFilter(item.id as TimelineFilter)}
                    size="sm"
                    type="button"
                    variant={isActive ? "default" : "secondary"}
                  >
                    {item.label}
                  </Button>
                )
              },
            )}
          </div>
        </div>

        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]">
          <aside className="grid min-h-0 content-start">
            <Card className="border-border/50 bg-card/92 shadow-lg">
              <CardHeader className="space-y-3">
                <div>
                  <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                    Quick timeline entry
                  </CardDescription>
                  <CardTitle className="mt-2 text-lg">Add the next event</CardTitle>
                  <CardDescription className="mt-2">
                    Keep the feed focused on concrete changes, decisions, and checkpoints.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TIMELINE_TYPE_ORDER.map((type) => {
                    const isActive = entryType === type
                    const tone = TIMELINE_TONES[type]

                    return (
                      <Button
                        key={type}
                        className={cn("rounded-full", isActive ? "" : "")}
                        onClick={() => onEntryTypeChange(type)}
                        size="sm"
                        style={
                          isActive
                            ? {
                                background: tone.accent,
                                color: "white",
                              }
                            : undefined
                        }
                        type="button"
                        variant={isActive ? "default" : "secondary"}
                      >
                        {TIMELINE_TYPE_LABELS[type]}
                      </Button>
                    )
                  })}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  ref={(node) => {
                    quickEntryRef.current = node

                    if (composerRef) {
                      composerRef.current = node
                    }
                  }}
                  className="min-h-[144px] resize-y bg-background/80 leading-6"
                  onChange={(event) => onDraftChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault()
                      onExitToVisualMode?.()
                      ;(event.target as HTMLTextAreaElement).blur()
                      sectionRef.current?.focus()
                      return
                    }

                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      onAddEntry()
                    }
                  }}
                  placeholder="Capture the latest signal, decision, mitigation step, or comms milestone..."
                  value={draft}
                />

                <div className="grid gap-2">
                  <Button onClick={onAddEntry} type="button">
                    Add to timeline
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => onDraftChange(COMPOSER_TEMPLATES[entryType])}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Use template
                    </Button>
                    {selectedEntityLabel && onSeedFromSelection ? (
                      <Button onClick={onSeedFromSelection} size="sm" type="button" variant="secondary">
                        Add board context
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          <div className="min-h-0 overflow-y-auto pr-1">
            <div className="grid gap-4">
              {filteredEntries.length === 0 ? (
                <EmptyState message="No timeline entries for this view yet. Use the quick entry panel to record the next decision, mitigation, update, or comms checkpoint." />
              ) : (
                filteredEntries.map((entry, index) => {
                  const linkedActions = entry.linkedActionIds.map((actionId) => ({
                    id: actionId,
                    label: getActionLabel(actionId),
                  }))
                  const currentDay = formatTimelineDay(entry.createdAt)
                  const previousEntry = index > 0 ? filteredEntries[index - 1] : null
                  const previousDay = previousEntry ? formatTimelineDay(previousEntry.createdAt) : null
                  const tone = TIMELINE_TONES[entry.type]


                  return (
                    <TimelineEntry
                      key={entry.id}
                      currentDay={currentDay}
                      previousDay={previousDay}
                      timestampLabel={formatLogTimestamp(entry.createdAt)}
                      secondaryLabel={entry.authorName}
                      tone={tone}
                    >
                      <CardContent className="grid gap-3 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="size-2.5 rounded-full"
                              style={{ background: entry.authorColor }}
                            />
                            <Badge variant={tone.badge}>{TIMELINE_TYPE_LABELS[entry.type]}</Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {entry.linkedActionIds.length === 0 ? (
                              <Button
                                onClick={() => onCreateActionFromEntry(entry.id)}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                Create action
                              </Button>
                            ) : (
                              <Button
                                onClick={onOpenActionBoard}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                Open actions
                              </Button>
                            )}
                            {onPromoteEntry ? (
                              <Button
                                onClick={() => onPromoteEntry(entry)}
                                size="sm"
                                type="button"
                                variant="secondary"
                              >
                                Promote to Case
                              </Button>
                            ) : null}
                            <Button
                              onClick={() => onDeleteEntry(entry.id)}
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>

                        <div className="whitespace-pre-wrap text-sm leading-7 text-foreground/85">
                          {entry.body}
                        </div>

                        {entry.linkedEntityIds.length > 0 || linkedActions.length > 0 ? (
                          <div className="grid gap-2">
                            {entry.linkedEntityIds.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {entry.linkedEntityIds.map((entityId) => (
                                  <Button
                                    key={entityId}
                                    onClick={() => onSelectEntity(entityId)}
                                    size="sm"
                                    type="button"
                                    variant="secondary"
                                  >
                                    {getEntityLabel(entityId)}
                                  </Button>
                                ))}
                              </div>
                            ) : null}

                            {linkedActions.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {linkedActions.map((action) => (
                                  <Button
                                    key={action.id}
                                    onClick={onOpenActionBoard}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                  >
                                    {action.label}
                                  </Button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </CardContent>
                    </TimelineEntry>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

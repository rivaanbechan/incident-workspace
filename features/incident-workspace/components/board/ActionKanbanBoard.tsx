"use client"

import { EmptyState } from "@/components/shell/EmptyState"
import { TonedCard } from "@/components/shell/TonedCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/native-select"
import type {
  IncidentActionItem,
  IncidentActionStatus,
} from "@/features/incident-workspace/lib/board/types"
import {
  ACTION_STATUS_LABELS,
  ACTION_STATUS_ORDER,
} from "@/features/incident-workspace/lib/board/constants"
import { cn } from "@/lib/utils"
import { useEffect, useRef, useState, type MutableRefObject } from "react"
import { StatusUpdateCard } from "@/features/incident-workspace/components/board/StatusUpdateCard"

type ActionKanbanBoardProps = {
  actions: IncidentActionItem[]
  availableOwners: Array<{
    label: string
    value: string
  }>
  getEntityLabel: (entityId: string) => string
  getTimelineEntryLabel: (entryId: string) => string
  onAddAction: (title: string) => void
  onLogActionStatusChange: (
    actionId: string,
    fromStatus: IncidentActionStatus,
    toStatus: IncidentActionStatus,
    comment: string,
  ) => void
  onOpenTimelineBoard: (entryId: string | null) => void
  onPromoteAction?: (action: IncidentActionItem) => void
  onSelectEntity: (entityId: string) => void
  onDeleteAction: (actionId: string) => void
  onUpdateAction: (
    actionId: string,
    updater: (action: IncidentActionItem) => IncidentActionItem,
  ) => void
  isVisualMode?: boolean
  onEnterInsertMode?: () => void
  onExitToVisualMode?: () => void
  composerRef?: MutableRefObject<HTMLInputElement | null>
  selectedEntityLabel?: string | null
  onCreateActionFromSelection?: () => void
}

const ACTION_STATUS_TONES: Record<
  IncidentActionStatus,
  { accent: string; badge: "critical" | "info" | "muted" | "success"; tint: string }
> = {
  blocked: {
    accent: "#dc2626",
    badge: "critical",
    tint: "rgba(220, 38, 38, 0.12)",
  },
  done: {
    accent: "#16a34a",
    badge: "success",
    tint: "rgba(22, 163, 74, 0.12)",
  },
  in_progress: {
    accent: "#2563eb",
    badge: "info",
    tint: "rgba(37, 99, 235, 0.12)",
  },
  open: {
    accent: "hsl(var(--muted-foreground))",
    badge: "muted",
    tint: "hsl(var(--muted) / 0.6)",
  },
}

export function ActionKanbanBoard({
  actions,
  availableOwners,
  getEntityLabel,
  getTimelineEntryLabel,
  onAddAction,
  onLogActionStatusChange,
  onOpenTimelineBoard,
  onPromoteAction,
  onSelectEntity,
  onDeleteAction,
  onUpdateAction,
  isVisualMode = false,
  onEnterInsertMode,
  onExitToVisualMode,
  composerRef,
  selectedEntityLabel,
  onCreateActionFromSelection,
}: ActionKanbanBoardProps) {
  const [actionDraft, setActionDraft] = useState("")
  const [draggedActionId, setDraggedActionId] = useState<string | null>(null)
  const [dropTargetStatus, setDropTargetStatus] = useState<IncidentActionStatus | null>(null)
  const [pendingStatusComments, setPendingStatusComments] = useState<
    Record<
      string,
      {
        comment: string
        fromStatus: IncidentActionStatus
        toStatus: IncidentActionStatus
      }
    >
  >({})
  const sectionRef = useRef<HTMLElement | null>(null)

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

  const actionColumns: IncidentActionStatus[] = ["open", "in_progress", "blocked", "done"]

  const queueStatusComment = (
    actionId: string,
    fromStatus: IncidentActionStatus,
    toStatus: IncidentActionStatus,
  ) => {
    if (fromStatus === toStatus) {
      return
    }

    setPendingStatusComments((current) => ({
      ...current,
      [actionId]: {
        comment: current[actionId]?.comment ?? "",
        fromStatus,
        toStatus,
      },
    }))
  }

  const dismissStatusComment = (actionId: string) => {
    setPendingStatusComments((current) => {
      const next = { ...current }
      delete next[actionId]
      return next
    })
  }

  const submitActionDraft = () => {
    const nextTitle = actionDraft.trim()

    if (!nextTitle) {
      return
    }

    onAddAction(nextTitle)
    setActionDraft("")
  }

  return (
    <section
      ref={sectionRef}
      className="relative grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] rounded-[20px] bg-background/35 outline-none"
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
        if (!isVisualMode || event.target !== sectionRef.current) {
          return
        }

        if (event.key === "Enter") {
          event.preventDefault()
          onEnterInsertMode?.()
          window.requestAnimationFrame(() => {
            composerRef?.current?.focus()
          })
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
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 p-4">
          <div>
            <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.14em]">
              Shared action board
            </CardDescription>
            <CardTitle className="mt-2 text-base">Incident work in motion</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actionColumns.map((status) => (
              <Badge key={status} variant={ACTION_STATUS_TONES[status].badge}>
                {ACTION_STATUS_LABELS[status]}: {actions.filter((action) => action.status === status).length}
              </Badge>
            ))}
          </div>
        </CardHeader>
      </Card>

      <Card className="rounded-none border-x-0 border-t-0 border-border/20 bg-background/70 shadow-none">
        <CardContent className="grid gap-3 p-4">
          <div className="flex flex-wrap gap-2">
            <Input
              ref={composerRef}
              className="min-w-[220px] flex-[1_1_260px] bg-background/80"
              onChange={(event) => setActionDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault()
                  onExitToVisualMode?.()
                  ;(event.target as HTMLInputElement).blur()
                  sectionRef.current?.focus()
                  return
                }

                if (event.key === "Enter") {
                  event.preventDefault()
                  submitActionDraft()
                }
              }}
              placeholder="Create an action item..."
              value={actionDraft}
            />
            <Button onClick={submitActionDraft} type="button">
              Add Action
            </Button>
          </div>

          {selectedEntityLabel && onCreateActionFromSelection ? (
            <Card className="border-border/40 bg-muted/50 shadow-none">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">Selected board item</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">{selectedEntityLabel}</div>
                </div>
                <Button onClick={onCreateActionFromSelection} size="sm" type="button" variant="secondary">
                  Create Action
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </CardContent>
      </Card>

      {actions.length === 0 ? (
        <div className="m-4">
          <EmptyState message="No actions yet. Add the next mitigation, handoff, or verification step." />
        </div>
      ) : (
        <div className="min-h-0 overflow-x-auto overflow-y-hidden bg-gradient-to-b from-card/60 to-muted/20 p-4">
          <div
            className="grid items-start"
            style={{
              gridAutoColumns: "minmax(280px, 1fr)",
              gridAutoFlow: "column",
              gap: 12,
              minHeight: "100%",
              minWidth: "max-content",
            }}
          >
            {actionColumns.map((status) => {
              const columnActions = actions.filter((action) => action.status === status)
              const isDropTarget = dropTargetStatus === status
              const tone = ACTION_STATUS_TONES[status]

              return (
                <TonedCard
                  key={status}
                  tint={tone.tint}
                  className={cn(
                    "grid h-full content-start gap-3 border-border/40 shadow-none transition-colors",
                    isDropTarget ? "border-foreground/30 bg-accent/60" : "bg-card/78",
                  )}
                  onDragLeave={() => {
                    setDropTargetStatus((current) => (current === status ? null : current))
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDropTargetStatus(status)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const actionId = event.dataTransfer.getData("text/plain")

                    if (actionId) {
                      const droppedAction = actions.find((action) => action.id === actionId)

                      onUpdateAction(actionId, (current) => ({
                        ...current,
                        status,
                      }))

                      if (droppedAction) {
                        queueStatusComment(droppedAction.id, droppedAction.status, status)
                      }
                    }

                    setDraggedActionId(null)
                    setDropTargetStatus(null)
                  }}
                >
                  <CardHeader className="gap-2 p-3 pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">{ACTION_STATUS_LABELS[status]}</CardTitle>
                      <Badge variant={tone.badge}>{columnActions.length}</Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="grid gap-3 p-3 pt-0">
                    {columnActions.length === 0 ? (
                      <EmptyState message="Drop an action here." size="sm" />
                    ) : null}

                    {columnActions.map((action) => {
                      const pendingStatusComment = pendingStatusComments[action.id]
                      const actionTone = ACTION_STATUS_TONES[action.status]

                      return (
                        <TonedCard
                          key={action.id}
                          tint={actionTone.tint}
                          className={cn(
                            "border-border/40 shadow-sm transition-colors",
                            draggedActionId === action.id ? "bg-accent/70" : "bg-card/96",
                          )}
                          draggable
                          onDragEnd={() => {
                            setDraggedActionId(null)
                            setDropTargetStatus(null)
                          }}
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/plain", action.id)
                            event.dataTransfer.effectAllowed = "move"
                            setDraggedActionId(action.id)
                          }}
                          style={{
                            cursor: "grab",
                          }}
                        >
                          <CardContent className="grid gap-3 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Badge variant="outline">Drag to move</Badge>
                              <div className="flex flex-wrap items-center gap-2">
                                <Select
                                  className="h-8 w-auto rounded-full text-[11px] font-semibold"
                                  onChange={(event) => {
                                    const nextStatus = event.target.value as IncidentActionStatus

                                    onUpdateAction(action.id, (current) => ({
                                      ...current,
                                      status: nextStatus,
                                    }))
                                    queueStatusComment(action.id, action.status, nextStatus)
                                  }}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  value={action.status}
                                >
                                  {Object.entries(ACTION_STATUS_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>
                                      {label}
                                    </option>
                                  ))}
                                </Select>
                                {onPromoteAction ? (
                                  <Button
                                    className="h-8 text-[11px]"
                                    onClick={() => onPromoteAction(action)}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                  >
                                    Promote
                                  </Button>
                                ) : null}
                                <Button
                                  className="h-8 text-[11px]"
                                  onClick={() => onDeleteAction(action.id)}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  size="sm"
                                  type="button"
                                  variant="ghost"
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>

                            <Input
                              className="h-auto border-0 bg-transparent px-0 text-sm font-semibold shadow-none focus-visible:ring-0"
                              onChange={(event) =>
                                onUpdateAction(action.id, (current) => ({
                                  ...current,
                                  title: event.target.value,
                                }))
                              }
                              onPointerDown={(event) => event.stopPropagation()}
                              value={action.title}
                            />

                            <Select
                              className="bg-background/80"
                              onChange={(event) =>
                                onUpdateAction(action.id, (current) => ({
                                  ...current,
                                  owner: event.target.value,
                                }))
                              }
                              onPointerDown={(event) => event.stopPropagation()}
                              value={action.owner}
                            >
                              <option value="">Unassigned</option>
                              {action.owner &&
                              !availableOwners.some((owner) => owner.value === action.owner) ? (
                                <option value={action.owner}>{action.owner}</option>
                              ) : null}
                              {availableOwners.map((owner) => (
                                <option key={owner.value} value={owner.value}>
                                  {owner.label}
                                </option>
                              ))}
                            </Select>

                            {action.sourceLogEntryId || action.linkedEntityIds.length > 0 ? (
                              <div className="grid gap-2">
                                {action.sourceLogEntryId ? (
                                  <Button
                                    className="justify-start"
                                    onClick={() => onOpenTimelineBoard(action.sourceLogEntryId)}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                  >
                                    From timeline: {getTimelineEntryLabel(action.sourceLogEntryId)}
                                  </Button>
                                ) : null}

                                {action.linkedEntityIds.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {action.linkedEntityIds.map((entityId) => (
                                      <Button
                                        key={entityId}
                                        onClick={() => onSelectEntity(entityId)}
                                        onPointerDown={(event) => event.stopPropagation()}
                                        size="sm"
                                        type="button"
                                        variant="secondary"
                                      >
                                        {getEntityLabel(entityId)}
                                      </Button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}

                            {pendingStatusComment ? (
                              <StatusUpdateCard
                                comment={pendingStatusComment.comment}
                                fromLabel={ACTION_STATUS_LABELS[pendingStatusComment.fromStatus]}
                                toLabel={ACTION_STATUS_LABELS[pendingStatusComment.toStatus]}
                                onChangeComment={(value) =>
                                  setPendingStatusComments((current) => ({
                                    ...current,
                                    [action.id]: { ...pendingStatusComment, comment: value },
                                  }))
                                }
                                onDismiss={() => dismissStatusComment(action.id)}
                                onSubmit={() => {
                                  onLogActionStatusChange(
                                    action.id,
                                    pendingStatusComment.fromStatus,
                                    pendingStatusComment.toStatus,
                                    pendingStatusComment.comment,
                                  )
                                  dismissStatusComment(action.id)
                                }}
                                stopPointerPropagation
                                submitLabel="Post to timeline"
                              />
                            ) : null}
                          </CardContent>
                        </TonedCard>
                      )
                    })}
                  </CardContent>
                </TonedCard>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

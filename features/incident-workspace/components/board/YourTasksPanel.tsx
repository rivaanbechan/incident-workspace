"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import type {
  IncidentActionItem,
  IncidentActionStatus,
} from "@/features/incident-workspace/lib/board/types"
import { cn } from "@/lib/utils"

type YourTasksPanelProps = {
  actions: IncidentActionItem[]
  getEntityLabel: (entityId: string) => string
  getTimelineEntryLabel: (entryId: string) => string
  onLogActionStatusChange: (
    actionId: string,
    fromStatus: IncidentActionStatus,
    toStatus: IncidentActionStatus,
    comment: string,
  ) => void
  onOpenActionBoard: () => void
  onOpenTimelineBoard: (entryId: string | null) => void
  onSelectEntity: (entityId: string) => void
  onUpdateAction: (
    actionId: string,
    updater: (action: IncidentActionItem) => IncidentActionItem,
  ) => void
}

const ACTION_STATUS_LABELS: Record<IncidentActionStatus, string> = {
  blocked: "Blocked",
  done: "Done",
  in_progress: "In Progress",
  open: "Open",
}

const STATUS_ORDER: IncidentActionStatus[] = ["open", "in_progress", "blocked", "done"]

function getStatusClass(status: IncidentActionStatus) {
  switch (status) {
    case "done":
      return "bg-success/15 text-success"
    case "blocked":
      return "bg-critical/15 text-critical"
    case "in_progress":
      return "bg-info/15 text-info"
    case "open":
    default:
      return "bg-muted text-foreground"
  }
}

export function YourTasksPanel({
  actions,
  getEntityLabel,
  getTimelineEntryLabel,
  onLogActionStatusChange,
  onOpenActionBoard,
  onOpenTimelineBoard,
  onSelectEntity,
  onUpdateAction,
}: YourTasksPanelProps) {
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

  const visibleActions = actions.filter(
    (action) => action.status !== "done" || Boolean(pendingStatusComments[action.id]),
  )

  const orderedActions = [...visibleActions].sort((left, right) => {
    const statusDelta = STATUS_ORDER.indexOf(left.status) - STATUS_ORDER.indexOf(right.status)

    if (statusDelta !== 0) {
      return statusDelta
    }

    return left.createdAt - right.createdAt
  })

  const remainingCount = actions.filter((action) => action.status !== "done").length

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

  if (orderedActions.length === 0) {
    return (
      <Card className="border-dashed border-border/70 bg-card shadow-none">
        <CardContent className="space-y-4 p-5 text-sm leading-6 text-muted-foreground">
          <p>
            No active tasks assigned to you right now. Open the action board to review shared work.
          </p>
          <Button onClick={onOpenActionBoard} type="button">
            Open Action Board
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-3">
      <Card className="border-border/50 bg-background/70 shadow-none">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 p-4">
          <div>
            <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.14em]">
              Your Tasks
            </CardDescription>
            <CardTitle className="mt-2 text-base">{remainingCount} remaining</CardTitle>
          </div>
          <Button onClick={onOpenActionBoard} type="button" variant="secondary">
            Open Action Board
          </Button>
        </CardHeader>
      </Card>

      {orderedActions.map((action) => {
        const pendingStatusComment = pendingStatusComments[action.id]

        return (
          <Card key={action.id} className="border-border/60 bg-card shadow-none">
            <CardContent className="grid gap-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge className={cn("uppercase tracking-[0.12em]", getStatusClass(action.status))}>
                  {ACTION_STATUS_LABELS[action.status]}
                </Badge>
                <Select
                  className="h-8 w-auto rounded-full px-3 text-xs font-semibold"
                  onChange={(event) => {
                    const nextStatus = event.target.value as IncidentActionStatus

                    onUpdateAction(action.id, (current) => ({
                      ...current,
                      status: nextStatus,
                    }))
                    queueStatusComment(action.id, action.status, nextStatus)
                  }}
                  value={action.status}
                >
                  {Object.entries(ACTION_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="text-sm font-semibold text-foreground">{action.title}</div>

              {action.sourceLogEntryId || action.linkedEntityIds.length > 0 ? (
                <div className="grid gap-2">
                  {action.sourceLogEntryId ? (
                    <Button
                      className="justify-start"
                      onClick={() => onOpenTimelineBoard(action.sourceLogEntryId)}
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
                <div className="grid gap-3 rounded-2xl border border-border/60 bg-background/80 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Post status update
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    {ACTION_STATUS_LABELS[pendingStatusComment.fromStatus]} to{" "}
                    {ACTION_STATUS_LABELS[pendingStatusComment.toStatus]}
                  </div>
                  <Textarea
                    onChange={(event) =>
                      setPendingStatusComments((current) => ({
                        ...current,
                        [action.id]: {
                          ...pendingStatusComment,
                          comment: event.target.value,
                        },
                      }))
                    }
                    placeholder="Optional note for the timeline..."
                    value={pendingStatusComment.comment}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        onLogActionStatusChange(
                          action.id,
                          pendingStatusComment.fromStatus,
                          pendingStatusComment.toStatus,
                          pendingStatusComment.comment,
                        )
                        dismissStatusComment(action.id)
                      }}
                      size="sm"
                      type="button"
                    >
                      Post Update
                    </Button>
                    <Button
                      onClick={() => dismissStatusComment(action.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

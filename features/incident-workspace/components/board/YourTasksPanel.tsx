"use client"

import { useState } from "react"

import { EmptyState } from "@/components/shell/EmptyState"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/native-select"
import { StatusUpdateCard } from "@/features/incident-workspace/components/board/StatusUpdateCard"
import type {
  IncidentActionItem,
  IncidentActionStatus,
} from "@/features/incident-workspace/lib/board/types"
import {
  ACTION_STATUS_LABELS,
  ACTION_STATUS_ORDER,
} from "@/features/incident-workspace/lib/board/constants"
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
    const statusDelta = ACTION_STATUS_ORDER.indexOf(left.status) - ACTION_STATUS_ORDER.indexOf(right.status)

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
      <EmptyState message="No active tasks assigned to you right now. Open the action board to review shared work.">
        <Button onClick={onOpenActionBoard} type="button">
          Open Action Board
        </Button>
      </EmptyState>
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
                />
              ) : null}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

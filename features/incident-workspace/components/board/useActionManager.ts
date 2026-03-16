"use client"

import type {
  IncidentActionItem,
  PresenceUser,
} from "@/features/incident-workspace/lib/board/types"
import {
  createIncidentActionItem as createRoomActionItem,
  createTypedIncidentLogEntry,
  parseIncidentActionItem,
  parseIncidentLogEntry,
  serializeIncidentActionItem,
  serializeIncidentLogEntry,
} from "@/features/incident-workspace/components/board/boardCore"
import { useCallback, useState } from "react"
import type React from "react"
import * as Y from "yjs"

type UseActionManagerArgs = {
  incidentActionsRef: React.RefObject<Y.Array<string> | null>
  incidentLogRef: React.RefObject<Y.Array<string> | null>
  user: PresenceUser
}

export function useActionManager({
  incidentActionsRef,
  incidentLogRef,
  user,
}: UseActionManagerArgs) {
  const [incidentActions, setIncidentActions] = useState<IncidentActionItem[]>([])

  const createActionItem = useCallback(
    (
      title: string,
      options?: {
        linkedEntityIds?: string[]
        sourceLogEntryId?: string | null
      },
    ) => {
      const actions = incidentActionsRef.current
      const nextTitle = title.trim()

      if (!actions || !nextTitle) {
        return
      }

      actions.push([serializeIncidentActionItem(createRoomActionItem(nextTitle, options))])
    },
    [incidentActionsRef],
  )

  const updateActionItem = useCallback(
    (actionId: string, updater: (action: IncidentActionItem) => IncidentActionItem) => {
      const actions = incidentActionsRef.current

      if (!actions) {
        return
      }

      const index = actions
        .toArray()
        .findIndex((value) => parseIncidentActionItem(value)?.id === actionId)

      if (index === -1) {
        return
      }

      const current = parseIncidentActionItem(actions.get(index))

      if (!current) {
        return
      }

      actions.delete(index, 1)
      actions.insert(index, [
        serializeIncidentActionItem(
          updater({ ...current, updatedAt: Date.now() }),
        ),
      ])
    },
    [incidentActionsRef],
  )

  const deleteActionItem = useCallback(
    (actionId: string) => {
      const actions = incidentActionsRef.current
      const incidentLogEntries = incidentLogRef.current

      if (!actions) {
        return
      }

      const index = actions
        .toArray()
        .findIndex((value) => parseIncidentActionItem(value)?.id === actionId)

      if (index === -1) {
        return
      }

      actions.delete(index, 1)

      if (!incidentLogEntries) {
        return
      }

      incidentLogEntries.toArray().forEach((value, logIndex) => {
        const entry = parseIncidentLogEntry(value)

        if (!entry || !entry.linkedActionIds.includes(actionId)) {
          return
        }

        incidentLogEntries.delete(logIndex, 1)
        incidentLogEntries.insert(logIndex, [
          serializeIncidentLogEntry({
            ...entry,
            linkedActionIds: entry.linkedActionIds.filter(
              (linkedActionId) => linkedActionId !== actionId,
            ),
          }),
        ])
      })
    },
    [incidentActionsRef, incidentLogRef],
  )

  const logActionStatusChange = useCallback(
    (
      actionId: string,
      fromStatus: IncidentActionItem["status"],
      toStatus: IncidentActionItem["status"],
      comment: string,
    ) => {
      const actions = incidentActionsRef.current
      const incidentLogEntries = incidentLogRef.current

      if (!actions || !incidentLogEntries || fromStatus === toStatus) {
        return
      }

      const action = actions
        .toArray()
        .map((value) => parseIncidentActionItem(value))
        .find((value) => value?.id === actionId)

      if (!action) {
        return
      }

      const nextComment = comment.trim()
      const statusLabels: Record<IncidentActionItem["status"], string> = {
        blocked: "Blocked",
        done: "Done",
        in_progress: "In Progress",
        open: "Open",
      }

      const body = [
        `Action status changed: ${action.title}`,
        `From: ${statusLabels[fromStatus]}`,
        `To: ${statusLabels[toStatus]}`,
        `Owner: ${action.owner.trim() || "Unassigned"}`,
        nextComment ? `Comment: ${nextComment}` : null,
      ]
        .filter(Boolean)
        .join("\n")

      incidentLogEntries.push([
        serializeIncidentLogEntry(
          createTypedIncidentLogEntry(user, {
            body,
            linkedActionIds: [action.id],
            linkedEntityIds: action.linkedEntityIds,
            type: "update",
          }),
        ),
      ])
    },
    [incidentActionsRef, incidentLogRef, user],
  )

  return {
    createActionItem,
    deleteActionItem,
    incidentActions,
    logActionStatusChange,
    setIncidentActions,
    updateActionItem,
  }
}

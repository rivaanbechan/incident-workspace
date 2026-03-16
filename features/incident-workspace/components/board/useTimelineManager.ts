"use client"

import type {
  IncidentLogEntry,
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

type UseTimelineManagerArgs = {
  incidentActionsRef: React.RefObject<Y.Array<string> | null>
  incidentLogRef: React.RefObject<Y.Array<string> | null>
  selectedEntityId: string | null
  user: PresenceUser
}

export function useTimelineManager({
  incidentActionsRef,
  incidentLogRef,
  selectedEntityId,
  user,
}: UseTimelineManagerArgs) {
  const [incidentLog, setIncidentLog] = useState<IncidentLogEntry[]>([])
  const [incidentLogDraft, setIncidentLogDraft] = useState("")
  const [incidentLogEntryType, setIncidentLogEntryType] =
    useState<IncidentLogEntry["type"]>("update")

  const addIncidentLogEntry = useCallback(() => {
    const incidentLogEntries = incidentLogRef.current
    const body = incidentLogDraft.trim()

    if (!incidentLogEntries || !body) {
      return
    }

    incidentLogEntries.push([
      serializeIncidentLogEntry(
        createTypedIncidentLogEntry(user, {
          body,
          linkedEntityIds: selectedEntityId ? [selectedEntityId] : [],
          type: incidentLogEntryType,
        }),
      ),
    ])
    setIncidentLogDraft("")
    setIncidentLogEntryType("update")
  }, [incidentLogDraft, incidentLogEntryType, incidentLogRef, selectedEntityId, user])

  const addPreparedIncidentLogEntry = useCallback(
    (input: {
      body: string
      linkedEntityIds?: string[]
      type: IncidentLogEntry["type"]
    }) => {
      const incidentLogEntries = incidentLogRef.current
      const body = input.body.trim()

      if (!incidentLogEntries || !body) {
        return
      }

      incidentLogEntries.push([
        serializeIncidentLogEntry(
          createTypedIncidentLogEntry(user, {
            body,
            linkedEntityIds: input.linkedEntityIds ?? [],
            type: input.type,
          }),
        ),
      ])
    },
    [incidentLogRef, user],
  )

  const deleteIncidentLogEntry = useCallback(
    (entryId: string) => {
      const incidentLogEntries = incidentLogRef.current
      const actions = incidentActionsRef.current

      if (!incidentLogEntries) {
        return
      }

      const index = incidentLogEntries
        .toArray()
        .findIndex((value) => parseIncidentLogEntry(value)?.id === entryId)

      if (index === -1) {
        return
      }

      incidentLogEntries.delete(index, 1)

      if (!actions) {
        return
      }

      actions.toArray().forEach((value, actionIndex) => {
        const action = parseIncidentActionItem(value)

        if (!action || action.sourceLogEntryId !== entryId) {
          return
        }

        actions.delete(actionIndex, 1)
        actions.insert(actionIndex, [
          serializeIncidentActionItem({
            ...action,
            sourceLogEntryId: null,
            updatedAt: Date.now(),
          }),
        ])
      })
    },
    [incidentActionsRef, incidentLogRef],
  )

  const createActionFromTimelineEntry = useCallback(
    (entryId: string) => {
      const actions = incidentActionsRef.current
      const incidentLogEntries = incidentLogRef.current

      if (!actions || !incidentLogEntries) {
        return
      }

      const logIndex = incidentLogEntries
        .toArray()
        .findIndex((value) => parseIncidentLogEntry(value)?.id === entryId)

      if (logIndex === -1) {
        return
      }

      const sourceEntry = parseIncidentLogEntry(incidentLogEntries.get(logIndex))

      if (!sourceEntry) {
        return
      }

      const nextAction = createRoomActionItem(
        sourceEntry.body.split("\n")[0]?.trim() || "Follow up",
        {
          linkedEntityIds: sourceEntry.linkedEntityIds,
          sourceLogEntryId: sourceEntry.id,
        },
      )

      actions.push([serializeIncidentActionItem(nextAction)])

      incidentLogEntries.delete(logIndex, 1)
      incidentLogEntries.insert(logIndex, [
        serializeIncidentLogEntry({
          ...sourceEntry,
          linkedActionIds: Array.from(
            new Set([...sourceEntry.linkedActionIds, nextAction.id]),
          ),
        }),
      ])
    },
    [incidentActionsRef, incidentLogRef],
  )

  return {
    addIncidentLogEntry,
    addPreparedIncidentLogEntry,
    createActionFromTimelineEntry,
    deleteIncidentLogEntry,
    incidentLog,
    incidentLogDraft,
    incidentLogEntryType,
    setIncidentLog,
    setIncidentLogDraft,
    setIncidentLogEntryType,
  }
}

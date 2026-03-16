"use client"

import type {
  BoardEntity,
  IncidentActionItem,
  IncidentLogEntry,
} from "@/features/incident-workspace/lib/board/types"
import type { MainWorkspaceTab, PendingMapPrompt } from "@/features/incident-workspace/components/board/boardShellShared"
import { getEntityMapKind } from "@/features/incident-workspace/components/board/boardShellShared"
import { useCallback } from "react"

type UseEntityActionsArgs = {
  addPreparedIncidentLogEntry: (entry: {
    body: string
    linkedEntityIds: string[]
    type: IncidentLogEntry["type"]
  }) => void
  createActionItem: (title: string, options?: { linkedEntityIds?: string[] }) => void
  entities: BoardEntity[]
  incidentActions: IncidentActionItem[]
  incidentLog: IncidentLogEntry[]
  selectedEntityId: string | null
  selectedEntityLabel: string | null
  selectSingleEntity: (entityId: string) => void
  setActiveMainTab: React.Dispatch<React.SetStateAction<MainWorkspaceTab>>
  setIncidentLogDraft: (value: string) => void
  setIncidentLogEntryType: (value: IncidentLogEntry["type"]) => void
  setIsCanvasVisualMode: (value: boolean) => void
  setPendingMapPrompt: React.Dispatch<React.SetStateAction<PendingMapPrompt | null>>
}

export function useEntityActions({
  addPreparedIncidentLogEntry,
  createActionItem,
  entities,
  incidentActions,
  incidentLog,
  selectedEntityId,
  selectedEntityLabel,
  selectSingleEntity,
  setActiveMainTab,
  setIncidentLogDraft,
  setIncidentLogEntryType,
  setIsCanvasVisualMode,
  setPendingMapPrompt,
}: UseEntityActionsArgs) {
  const getEntityLabel = useCallback(
    (entityId: string) => {
      const entity = entities.find((item) => item.id === entityId)

      if (!entity) {
        return "Unknown"
      }

      return entity.type === "statusMarker" ? entity.label : entity.title
    },
    [entities],
  )

  const getEntityFeedTemplate = (entity: BoardEntity) => {
    const mapKind = getEntityMapKind(entity)

    if (mapKind === "scope" && entity.type === "incidentCard") {
      return {
        draft: `Impact update: ${entity.title}\nImpact summary: ${entity.body.split("\n")[0] || "Confirm affected scope."}\nOwner: ${entity.owner?.trim() || "Unassigned"}`,
        type: "update" as const,
      }
    }

    if (mapKind === "handoff" && entity.type === "note") {
      return {
        draft: `Handoff: ${entity.title}\nCurrent state: ${entity.body.split("\n")[0] || "Summarize current state."}\nOwner: ${entity.owner?.trim() || "Unassigned"}`,
        type: "owner_change" as const,
      }
    }

    if (mapKind === "evidence" && entity.type === "note") {
      return {
        draft: `Evidence update: ${entity.title}\nSummary: ${entity.body.split("\n")[0] || "Add supporting evidence."}\nSource: ${entity.sourceLabel?.trim() || "Not set"}`,
        type: "update" as const,
      }
    }

    return {
      draft: `Board context: ${getEntityLabel(entity.id)}`,
      type: "update" as const,
    }
  }

  const openFeedForEntity = (entityId: string) => {
    const entity = entities.find((item) => item.id === entityId)

    if (!entity) {
      return
    }

    const feedTemplate = getEntityFeedTemplate(entity)

    selectSingleEntity(entityId)
    setIncidentLogEntryType(feedTemplate.type)
    setIncidentLogDraft(feedTemplate.draft)
    setActiveMainTab("feed")
    setPendingMapPrompt((current) => (current?.entityId === entityId ? null : current))
  }

  const logEntityToFeed = (entityId: string) => {
    const entity = entities.find((item) => item.id === entityId)

    if (!entity) {
      return
    }

    const feedTemplate = getEntityFeedTemplate(entity)

    selectSingleEntity(entityId)
    addPreparedIncidentLogEntry({
      body: feedTemplate.draft,
      linkedEntityIds: [entityId],
      type: feedTemplate.type,
    })
    setPendingMapPrompt((current) => (current?.entityId === entityId ? null : current))
    setActiveMainTab("feed")
  }

  const createActionForEntity = (entityId: string) => {
    const entity = entities.find((item) => item.id === entityId)

    if (!entity) {
      return
    }

    selectSingleEntity(entityId)
    createActionItem(`${getEntityLabel(entityId)} follow-up`, {
      linkedEntityIds: [entityId],
    })
    setActiveMainTab("actions")
    setPendingMapPrompt((current) => (current?.entityId === entityId ? null : current))
  }

  const handleCreateActionFromSelected = () => {
    if (!selectedEntityLabel || !selectedEntityId) {
      return
    }

    createActionItem(`Follow up: ${selectedEntityLabel}`, {
      linkedEntityIds: [selectedEntityId],
    })
    setActiveMainTab("actions")
  }

  const handleAddSelectedToTimeline = () => {
    if (!selectedEntityId || !selectedEntityLabel) {
      return
    }

    openFeedForEntity(selectedEntityId)
  }

  const handleRevealEntity = (entityId: string) => {
    selectSingleEntity(entityId)
    setIsCanvasVisualMode(true)
    setActiveMainTab("canvas")
  }

  const getTimelineEntrySummary = (entry: IncidentLogEntry) =>
    entry.body.split("\n")[0]?.trim() || "Timeline entry"

  const getActionLabel = (actionId: string) => {
    const action = incidentActions.find((item) => item.id === actionId)

    return action?.title ?? "Unknown action"
  }

  const getTimelineEntryLabel = (entryId: string) => {
    const entry = incidentLog.find((item) => item.id === entryId)

    return entry ? getTimelineEntrySummary(entry) : "Unknown timeline entry"
  }

  return {
    createActionForEntity,
    getActionLabel,
    getEntityLabel,
    getTimelineEntryLabel,
    handleAddSelectedToTimeline,
    handleCreateActionFromSelected,
    handleRevealEntity,
    logEntityToFeed,
    openFeedForEntity,
  }
}

"use client"

import type { EntityRef } from "@/lib/contracts/entities"
import type {
  BoardEntity,
  IncidentLogEntry,
} from "@/features/incident-workspace/lib/board/types"
import { useToast } from "@/components/shell/ToastProvider"
import { createCaseRecordViaApi } from "@/features/incident-workspace/lib/caseRecordPromotion"
import { useState } from "react"

type IncidentAction = {
  id: string
  linkedEntityIds: string[]
  owner: string
  sourceLogEntryId?: string | null
  status: string
  title: string
}

type UseCasePromotionArgs = {
  entities: BoardEntity[]
  linkedCaseId?: string | null
  roomId: string
  selectedEntity: BoardEntity | null
}

function getEntityRefForBoardEntity(entity: BoardEntity): EntityRef | null {
  if (entity.type === "incidentCard") {
    const kind =
      entity.scopeType === "identity"
        ? "identity"
        : entity.scopeType === "service"
          ? "service"
          : entity.scopeType === "tenant"
            ? "cloud-resource"
            : entity.scopeType === "detection"
              ? "alert"
              : "host"

    return {
      id: entity.id,
      kind,
      label: entity.title,
      sourceModule: "incident-workspace",
    }
  }

  return null
}

function getTimelineEntrySummary(entry: IncidentLogEntry) {
  return entry.body.split("\n")[0]?.trim() || "Timeline entry"
}

export function useCasePromotion({
  entities,
  linkedCaseId,
  roomId,
  selectedEntity,
}: UseCasePromotionArgs) {
  const [promotingSourceId, setPromotingSourceId] = useState<string | null>(null)
  const { showToast } = useToast()

  const buildLinkedEntityRefs = (linkedEntityIds: string[]) =>
    linkedEntityIds.flatMap((entityId) => {
      const entity = entities.find((item) => item.id === entityId)
      const ref = entity ? getEntityRefForBoardEntity(entity) : null

      return ref ? [ref] : []
    })

  const persistCaseRecord = async (
    sourceId: string,
    record: {
      kind: "action" | "decision" | "evidence" | "finding" | "hypothesis" | "timeline-event"
      payload?: Record<string, unknown>
      relatedEntities?: EntityRef[]
      sourceType: "action-item" | "incident-card" | "note" | "timeline-entry"
      summary: string
      title: string
    },
  ) => {
    if (!linkedCaseId) {
      showToast({
        message: "Link this room to a case before promoting durable records.",
        tone: "error",
      })
      return
    }

    try {
      setPromotingSourceId(sourceId)
      await createCaseRecordViaApi({
        caseId: linkedCaseId,
        record: {
          deepLink: {
            href:
              record.sourceType === "action-item"
                ? `/board/${roomId}?tab=actions`
                : record.sourceType === "timeline-entry"
                  ? `/board/${roomId}?tab=feed`
                  : `/board/${roomId}`,
            moduleId: "incident-workspace",
          },
          kind: record.kind,
          payload: record.payload ?? {},
          relatedEntities: record.relatedEntities ?? [],
          sourceId,
          sourceModule: "incident-workspace",
          sourceRoomId: roomId,
          sourceType: record.sourceType,
          summary: record.summary,
          title: record.title,
        },
      })

      showToast({
        message: `Promoted "${record.title}" into the case.`,
        tone: "success",
      })
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Unable to promote this record.",
        tone: "error",
      })
    } finally {
      setPromotingSourceId(null)
    }
  }

  const promoteSelectedEntityToCase = () => {
    if (
      !selectedEntity ||
      (selectedEntity.type !== "incidentCard" && selectedEntity.type !== "note")
    ) {
      return
    }

    if (selectedEntity.type === "incidentCard") {
      const entityRef = getEntityRefForBoardEntity(selectedEntity)
      void persistCaseRecord(selectedEntity.id, {
        kind: "finding",
        payload: {
          body: selectedEntity.body,
          owner: selectedEntity.owner ?? "",
          scopeType: selectedEntity.scopeType ?? null,
          severity: selectedEntity.severity,
          status: selectedEntity.status,
        },
        relatedEntities: entityRef ? [entityRef] : [],
        sourceType: "incident-card",
        summary: selectedEntity.body || "Incident card promoted from the workspace.",
        title: selectedEntity.title,
      })
      return
    }

    const noteKind =
      selectedEntity.mapKind === "hypothesis"
        ? "hypothesis"
        : selectedEntity.mapKind === "evidence"
          ? "evidence"
          : "finding"

    void persistCaseRecord(selectedEntity.id, {
      kind: noteKind,
      payload: {
        body: selectedEntity.body,
        mapKind: selectedEntity.mapKind ?? null,
        owner: selectedEntity.owner ?? "",
        sourceLabel: selectedEntity.sourceLabel ?? "",
        state: selectedEntity.state ?? null,
      },
      relatedEntities: [],
      sourceType: "note",
      summary: selectedEntity.body || "Workspace note promoted into the case.",
      title: selectedEntity.title,
    })
  }

  const promoteTimelineEntryToCase = (entry: IncidentLogEntry) => {
    void persistCaseRecord(entry.id, {
      kind: entry.type === "decision" ? "decision" : "timeline-event",
      payload: {
        authorId: entry.authorId,
        authorName: entry.authorName,
        entryType: entry.type,
        linkedActionIds: entry.linkedActionIds,
        linkedEntityIds: entry.linkedEntityIds,
      },
      relatedEntities: buildLinkedEntityRefs(entry.linkedEntityIds),
      sourceType: "timeline-entry",
      summary: entry.body,
      title: getTimelineEntrySummary(entry),
    })
  }

  const promoteActionToCase = (action: IncidentAction) => {
    void persistCaseRecord(action.id, {
      kind: "action",
      payload: {
        linkedEntityIds: action.linkedEntityIds,
        owner: action.owner,
        sourceLogEntryId: action.sourceLogEntryId,
        status: action.status,
      },
      relatedEntities: buildLinkedEntityRefs(action.linkedEntityIds),
      sourceType: "action-item",
      summary: `Owner: ${action.owner.trim() || "Unassigned"} · Status: ${action.status.replaceAll("_", " ")}`,
      title: action.title,
    })
  }

  return {
    promotingSourceId,
    promoteSelectedEntityToCase,
    promoteTimelineEntryToCase,
    promoteActionToCase,
  }
}

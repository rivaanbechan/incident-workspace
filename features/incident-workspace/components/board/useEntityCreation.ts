"use client"

import type { BoardEntity, BoardPoint } from "@/features/incident-workspace/lib/board/types"
import type { PendingMapPrompt } from "@/features/incident-workspace/components/board/boardShellShared"
import {
  createIncidentCard,
  createInvestigationZone,
  createNote,
  nextBackgroundZIndex,
} from "@/features/incident-workspace/components/board/boardCore"

function getMinimumNoteHeight(mapKind?: string) {
  if (mapKind === "hypothesis") {
    return 500
  }

  if (mapKind === "evidence" || mapKind === "blocker" || mapKind === "handoff") {
    return 480
  }

  return 420
}

function getMinimumIncidentCardHeight(mapKind?: string) {
  if (mapKind === "scope") {
    return 520
  }

  return 420
}

type UseEntityCreationArgs = {
  createEntityAtViewportCenter: (
    factory: (point: BoardPoint, zIndex: number) => BoardEntity,
  ) => string | null | undefined
  entities: BoardEntity[]
  setPendingMapPrompt: React.Dispatch<React.SetStateAction<PendingMapPrompt | null>>
}

export function useEntityCreation({
  createEntityAtViewportCenter,
  entities,
  setPendingMapPrompt,
}: UseEntityCreationArgs) {
  const handleCreateNote = () => {
    const entityId = createEntityAtViewportCenter((point, zIndex) => ({
      ...createNote(point, zIndex),
      body: "Hypothesis:\nWhy it fits:\nHow to verify:",
      height: getMinimumNoteHeight("hypothesis"),
      mapKind: "hypothesis",
      owner: "",
      state: "new",
      title: "New hypothesis",
    }))

    if (entityId) {
      setPendingMapPrompt(null)
    }
  }

  const handleCreateIncidentCard = () => {
    const entityId = createEntityAtViewportCenter((point, zIndex) => ({
      ...createIncidentCard(point, zIndex),
      body: "Affected scope:\nObserved signal:\nImpact summary:",
      height: getMinimumIncidentCardHeight("scope"),
      mapKind: "scope",
      owner: "",
      scopeType: "service",
      title: "Impact assessment",
    }))

    if (entityId) {
      setPendingMapPrompt({ entityId, recommendedAction: "feed" })
    }
  }

  const handleCreateStatusMarker = () => {
    const entityId = createEntityAtViewportCenter((point, zIndex) => ({
      ...createNote(point, zIndex),
      body: "Blocker:\nWhat is blocked:\nUnblock condition:",
      color: "#fee2e2",
      height: getMinimumNoteHeight("blocker"),
      mapKind: "blocker",
      owner: "",
      title: "New blocker",
    }))

    if (entityId) {
      setPendingMapPrompt({ entityId, recommendedAction: "action" })
    }
  }

  const handleCreateZone = () => {
    createEntityAtViewportCenter((point) => {
      const nextZ = nextBackgroundZIndex(entities)

      return {
        ...createInvestigationZone(point, nextZ),
        title: "Investigation zone",
      }
    })
    setPendingMapPrompt(null)
  }

  const handleCreateHypothesis = () => {
    const entityId = createEntityAtViewportCenter((point, zIndex) => ({
      ...createNote(point, zIndex),
      body: "Hypothesis:\nWhy it fits:\nHow to verify:",
      height: getMinimumNoteHeight("hypothesis"),
      mapKind: "hypothesis",
      owner: "",
      state: "new",
      title: "Hypothesis",
    }))

    if (entityId) {
      setPendingMapPrompt(null)
    }
  }

  const handleCreateImpactNote = () => {
    const entityId = createEntityAtViewportCenter((point, zIndex) => ({
      ...createIncidentCard(point, zIndex),
      body: "Affected scope:\nObserved signal:\nImpact summary:",
      height: getMinimumIncidentCardHeight("scope"),
      mapKind: "scope",
      owner: "",
      scopeType: "service",
      title: "Impact assessment",
    }))

    if (entityId) {
      setPendingMapPrompt({ entityId, recommendedAction: "feed" })
    }
  }

  const handleCreateEvidenceNote = () => {
    const entityId = createEntityAtViewportCenter((point, zIndex) => ({
      ...createNote(point, zIndex),
      body: "Evidence summary:\nWhy it matters:\nDeep link / source:",
      color: "#dbeafe",
      height: getMinimumNoteHeight("evidence"),
      mapKind: "evidence",
      sourceLabel: "",
      title: "Evidence reference",
    }))

    if (entityId) {
      setPendingMapPrompt({ entityId, recommendedAction: "feed" })
    }
  }

  const handleCreateBlocker = () => {
    const entityId = createEntityAtViewportCenter((point, zIndex) => ({
      ...createNote(point, zIndex),
      body: "Blocker:\nWhat is blocked:\nUnblock condition:",
      color: "#fee2e2",
      height: getMinimumNoteHeight("blocker"),
      mapKind: "blocker",
      owner: "",
      title: "Blocker",
    }))

    if (entityId) {
      setPendingMapPrompt({ entityId, recommendedAction: "action" })
    }
  }

  const handleCreateHandoff = () => {
    const entityId = createEntityAtViewportCenter((point, zIndex) => ({
      ...createNote(point, zIndex),
      body: "Context:\nCurrent state:\nNext action:\nOwner:",
      height: getMinimumNoteHeight("handoff"),
      mapKind: "handoff",
      owner: "",
      title: "Handoff",
    }))

    if (entityId) {
      setPendingMapPrompt({ entityId, recommendedAction: "feed" })
    }
  }

  return {
    handleCreateNote,
    handleCreateIncidentCard,
    handleCreateStatusMarker,
    handleCreateZone,
    handleCreateHypothesis,
    handleCreateImpactNote,
    handleCreateEvidenceNote,
    handleCreateBlocker,
    handleCreateHandoff,
  }
}

"use client"

import type {
  BoardConnection,
  BoardEntity,
  IncidentActionItem,
  IncidentLogEntry,
  PresenceState,
} from "@/features/incident-workspace/lib/board/types"
import { createContext, useContext } from "react"

export type BoardEntitiesContextValue = {
  connections: BoardConnection[]
  entities: BoardEntity[]
  getEntityLabel: (entityId: string) => string
  incidentActions: IncidentActionItem[]
  incidentLog: IncidentLogEntry[]
  onCreateActionForEntity: (entityId: string) => void
  onCreateBlocker: () => void
  onCreateEvidenceNote: () => void
  onCreateHandoff: () => void
  onCreateHypothesis: () => void
  onCreateImpactNote: () => void
  onCreateZone: () => void
  onDeleteConnection: (connectionId: string) => void
  onLogEntityToFeed: (entityId: string) => void
  onRenameConnectionLabel: (connectionId: string, currentLabel: string) => void
  presence: PresenceState[]
  remoteSelections: Map<string, string>
  updateEntity: (entityId: string, updater: (entity: BoardEntity) => BoardEntity) => void
}

export const BoardEntitiesContext = createContext<BoardEntitiesContextValue | null>(null)

export function useBoardEntities() {
  const value = useContext(BoardEntitiesContext)

  if (!value) {
    throw new Error("useBoardEntities must be used within a BoardEntitiesContext.Provider")
  }

  return value
}

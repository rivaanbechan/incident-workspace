"use client"

import type { BoardConnection, BoardEntity } from "@/features/incident-workspace/lib/board/types"
import type { InvestigationMapKind } from "@/features/incident-workspace/lib/board/types"
import { createContext, useContext } from "react"

export type BoardSelectionContextValue = {
  clearEntitySelection: () => void
  onDeleteSelectedEntity: () => void
  onPromoteSelectedEntity: () => void
  promotingSourceId: string | null
  selectedEntity: BoardEntity | null
  selectedEntityConnections: BoardConnection[]
  selectedEntityId: string | null
  selectedEntityIds: string[]
  selectedEntityLabel: string | null
  selectedEntityLinkedActionCount: number
  selectedEntityLinkedEntryCount: number
  selectedEntityMapKind: InvestigationMapKind | null
  selectSingleEntity: (entityId: string) => void
  toggleEntitySelection: (entityId: string) => void
}

export const BoardSelectionContext = createContext<BoardSelectionContextValue | null>(null)

export function useBoardSelection() {
  const value = useContext(BoardSelectionContext)

  if (!value) {
    throw new Error("useBoardSelection must be used within a BoardSelectionContext.Provider")
  }

  return value
}

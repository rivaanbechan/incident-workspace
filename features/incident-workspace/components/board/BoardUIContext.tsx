"use client"

import type { CameraState, PresenceUser } from "@/features/incident-workspace/lib/board/types"
import type { ConnectionStatus } from "@/features/incident-workspace/components/board/boardCore"
import type { BoardConnectionType } from "@/features/incident-workspace/lib/board/types"
import type { PendingMapPrompt } from "@/features/incident-workspace/components/board/boardShellShared"
import type { InvestigationSeverity, InvestigationStatus } from "@/lib/contracts/investigations"
import { createContext, useContext } from "react"

type ConnectionToneMap = Record<BoardConnectionType, { color: string; label: string }>

export type BoardUIContextValue = {
  areZonesEditable: boolean
  camera: CameraState
  commandHints: string[]
  connectionDraftCustomLabel: string
  connectionDraftType: BoardConnectionType
  connectionStatus: ConnectionStatus
  connectionToneMap: ConnectionToneMap
  isBoardFocused: boolean
  isBoardFullscreen: boolean
  isCanvasVisualMode: boolean
  isHelpOpen: boolean
  isPanning: boolean
  linkedCaseId?: string | null
  pendingConnectionSourceId: string | null
  remainingAssignedTaskCount: number
  user: PresenceUser
  visiblePendingMapPrompt: PendingMapPrompt | null
  visibleSeverity: InvestigationSeverity
  visibleStatus: InvestigationStatus
  // Setters and actions
  onActiveRailPanelOpen: () => void
  onConnectDraftCustomLabelChange: (value: string) => void
  onConnectDraftTypeChange: (value: BoardConnectionType) => void
  onDismissPendingMapPrompt: () => void
  onLinkArtifactCancel: () => void
  onLinkArtifactStart: (entityId: string) => void
  onToggleBoardFullscreen: () => void
  onToggleHelpOpen: () => void
  onToggleZoneEditing: () => void
  setCamera: (camera: CameraState | ((prev: CameraState) => CameraState)) => void
  setIsCanvasVisualMode: (value: boolean) => void
}

export const BoardUIContext = createContext<BoardUIContextValue | null>(null)

export function useBoardUI() {
  const value = useContext(BoardUIContext)

  if (!value) {
    throw new Error("useBoardUI must be used within a BoardUIContext.Provider")
  }

  return value
}

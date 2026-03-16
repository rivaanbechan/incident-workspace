"use client"

import type {
  BoardConnection,
  BoardConnectionType,
  BoardEntity,
} from "@/features/incident-workspace/lib/board/types"
import { useCallback, useState } from "react"

type UseConnectionFlowArgs = {
  connectionDraftCustomLabel: string
  connectionDraftType: BoardConnectionType
  createConnection: (
    sourceId: string,
    targetId: string,
    type: BoardConnectionType,
    customLabel?: string,
  ) => void
  entities: BoardEntity[]
  getEntityLabel: (entityId: string) => string
  selectedEntityId: string | null
  setConnectionDraftCustomLabel: (value: string) => void
  setConnectionDraftType: (value: BoardConnectionType) => void
  updateConnection: (
    connectionId: string,
    updater: (c: BoardConnection) => BoardConnection,
  ) => void
}

export function useConnectionFlow({
  connectionDraftCustomLabel,
  connectionDraftType,
  createConnection,
  entities,
  getEntityLabel,
  selectedEntityId,
  setConnectionDraftCustomLabel,
  setConnectionDraftType,
  updateConnection,
}: UseConnectionFlowArgs) {
  const [pendingConnectionSourceId, setPendingConnectionSourceId] = useState<string | null>(null)

  const handleConnectToEntity = useCallback(
    (targetEntityId: string) => {
      if (!pendingConnectionSourceId || pendingConnectionSourceId === targetEntityId) {
        return
      }

      createConnection(
        pendingConnectionSourceId,
        targetEntityId,
        connectionDraftType,
        connectionDraftType === "custom" ? connectionDraftCustomLabel : undefined,
      )
      setPendingConnectionSourceId(null)
      if (connectionDraftType === "custom") {
        setConnectionDraftCustomLabel("")
        setConnectionDraftType("supports")
      }
    },
    [
      connectionDraftCustomLabel,
      connectionDraftType,
      createConnection,
      pendingConnectionSourceId,
      setConnectionDraftCustomLabel,
      setConnectionDraftType,
    ],
  )

  const renameConnectionLabel = useCallback(
    (connectionId: string, currentLabel: string) => {
      if (typeof window === "undefined") {
        return
      }

      const nextLabel = window.prompt("Rename this connection", currentLabel)

      if (!nextLabel || !nextLabel.trim()) {
        return
      }

      updateConnection(connectionId, (current) => ({
        ...current,
        customLabel: nextLabel.trim(),
        type: "custom",
      }))
    },
    [updateConnection],
  )

  const isLinkableArtifactEntity = (entity: BoardEntity | null) =>
    entity?.type === "incidentCard" || entity?.type === "note"

  const handleShiftLinkToEntity = useCallback(
    (targetEntityId: string) => {
      if (
        !selectedEntityId ||
        selectedEntityId === targetEntityId ||
        typeof window === "undefined"
      ) {
        return false
      }

      const sourceEntity = entities.find((entity) => entity.id === selectedEntityId) ?? null
      const targetEntity = entities.find((entity) => entity.id === targetEntityId) ?? null

      if (!isLinkableArtifactEntity(sourceEntity) || !isLinkableArtifactEntity(targetEntity)) {
        return false
      }

      const nextLabel = window.prompt(
        "Name this connection",
        connectionDraftType === "custom"
          ? connectionDraftCustomLabel.trim()
          : `${getEntityLabel(selectedEntityId)} -> ${getEntityLabel(targetEntityId)}`,
      )

      if (!nextLabel || !nextLabel.trim()) {
        return true
      }

      createConnection(selectedEntityId, targetEntityId, "custom", nextLabel.trim())
      setPendingConnectionSourceId(null)
      setConnectionDraftCustomLabel("")
      setConnectionDraftType("supports")
      return true
    },
    [
      connectionDraftCustomLabel,
      connectionDraftType,
      createConnection,
      entities,
      getEntityLabel,
      selectedEntityId,
      setConnectionDraftCustomLabel,
      setConnectionDraftType,
    ],
  )

  return {
    handleConnectToEntity,
    handleShiftLinkToEntity,
    pendingConnectionSourceId,
    renameConnectionLabel,
    setPendingConnectionSourceId,
  }
}

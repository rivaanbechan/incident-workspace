"use client"

import type { BoardConnection } from "@/features/incident-workspace/lib/board/types"
import {
  createBoardConnection as createRoomConnection,
  parseBoardConnection,
  serializeBoardConnection,
} from "@/features/incident-workspace/components/board/boardCore"
import { useCallback, useState } from "react"
import type React from "react"
import * as Y from "yjs"

type UseConnectionManagerArgs = {
  connectionsRef: React.RefObject<Y.Array<string> | null>
}

export function useConnectionManager({ connectionsRef }: UseConnectionManagerArgs) {
  const [connections, setConnections] = useState<BoardConnection[]>([])

  const createConnection = useCallback(
    (
      sourceEntityId: string,
      targetEntityId: string,
      type: BoardConnection["type"],
      customLabel?: string,
    ) => {
      const connectionsList = connectionsRef.current

      if (!connectionsList || sourceEntityId === targetEntityId) {
        return
      }

      const existing = connectionsList
        .toArray()
        .map(parseBoardConnection)
        .find(
          (connection) =>
            connection &&
            connection.sourceEntityId === sourceEntityId &&
            connection.targetEntityId === targetEntityId &&
            connection.type === type &&
            (connection.customLabel ?? "") ===
              (type === "custom" ? customLabel?.trim() ?? "" : ""),
        )

      if (existing) {
        return
      }

      connectionsList.push([
        serializeBoardConnection(
          createRoomConnection(sourceEntityId, targetEntityId, type, customLabel),
        ),
      ])
    },
    [connectionsRef],
  )

  const deleteConnection = useCallback(
    (connectionId: string) => {
      const connectionsList = connectionsRef.current

      if (!connectionsList) {
        return
      }

      const index = connectionsList
        .toArray()
        .findIndex((value) => parseBoardConnection(value)?.id === connectionId)

      if (index !== -1) {
        connectionsList.delete(index, 1)
      }
    },
    [connectionsRef],
  )

  const updateConnection = useCallback(
    (
      connectionId: string,
      updater: (connection: BoardConnection) => BoardConnection,
    ) => {
      const connectionsList = connectionsRef.current

      if (!connectionsList) {
        return
      }

      const index = connectionsList
        .toArray()
        .findIndex((value) => parseBoardConnection(value)?.id === connectionId)

      if (index === -1) {
        return
      }

      const current = parseBoardConnection(connectionsList.get(index))

      if (!current) {
        return
      }

      connectionsList.delete(index, 1)
      connectionsList.insert(index, [
        serializeBoardConnection(
          updater({ ...current, updatedAt: Date.now() }),
        ),
      ])
    },
    [connectionsRef],
  )

  return {
    connections,
    createConnection,
    deleteConnection,
    setConnections,
    updateConnection,
  }
}

"use client"

import type { BoardConnection, BoardEntity, BoardPoint } from "@/features/incident-workspace/lib/board/types"
import {
  nextZIndex,
  parseEntity,
  parseBoardConnection,
  screenToBoard,
  serializeBoardConnection,
  serializeEntity,
} from "@/features/incident-workspace/components/board/boardCore"
import { useCallback, useEffect, useRef, useState } from "react"
import type React from "react"
import * as Y from "yjs"

type UseEntityManagerArgs = {
  cameraRef: React.MutableRefObject<import("@/features/incident-workspace/lib/board/types").CameraState>
  connectionsRef: React.MutableRefObject<Y.Array<string> | null>
  entityMapRef: React.MutableRefObject<Y.Map<string> | null>
  isSynced: boolean
  stageRef: React.MutableRefObject<HTMLDivElement | null>
}

export function useEntityManager({
  cameraRef,
  connectionsRef,
  entityMapRef,
  stageRef,
}: UseEntityManagerArgs) {
  const [entities, setEntities] = useState<BoardEntity[]>([])
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const entitiesRef = useRef<BoardEntity[]>([])

  useEffect(() => {
    entitiesRef.current = entities
  }, [entities])

  const createEntityAtViewportCenter = useCallback(
    (factory: (point: BoardPoint, zIndex: number) => BoardEntity) => {
      const stage = stageRef.current
      const entityMap = entityMapRef.current

      if (!stage || !entityMap) {
        return null
      }

      const rect = stage.getBoundingClientRect()
      const point = screenToBoard(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        rect,
        cameraRef.current,
      )

      const entity = factory(
        { x: point.x, y: point.y },
        nextZIndex(entitiesRef.current),
      )

      const centeredEntity = {
        ...entity,
        x: point.x - entity.width / 2,
        y: point.y - entity.height / 2,
      }

      entityMap.set(centeredEntity.id, serializeEntity(centeredEntity))
      setSelectedEntityId(centeredEntity.id)
      return centeredEntity.id
    },
    [cameraRef, entityMapRef, stageRef],
  )

  const createEntitiesAtViewportCenter = useCallback(
    (
      factory: (point: BoardPoint, startZIndex: number) => BoardEntity[],
      options?: { replaceEntityIds?: string[] },
    ) => {
      const stage = stageRef.current
      const entityMap = entityMapRef.current

      if (!stage || !entityMap) {
        return []
      }

      const rect = stage.getBoundingClientRect()
      const point = screenToBoard(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        rect,
        cameraRef.current,
      )

      const nextEntities = factory(
        { x: point.x - 560, y: point.y - 360 },
        nextZIndex(entitiesRef.current),
      )

      const replaceEntityIds = options?.replaceEntityIds ?? []

      entityMap.doc?.transact(() => {
        replaceEntityIds.forEach((entityId) => {
          entityMap.delete(entityId)
        })

        nextEntities.forEach((entity) => {
          entityMap.set(entity.id, serializeEntity(entity))
        })
      })

      setSelectedEntityId(nextEntities[0]?.id ?? null)
      return nextEntities.map((entity) => entity.id)
    },
    [cameraRef, entityMapRef, stageRef],
  )

  const createBoardSeedAtViewportCenter = useCallback(
    (
      factory: (
        point: BoardPoint,
        startZIndex: number,
      ) => { connections: BoardConnection[]; entities: BoardEntity[] },
      options?: { replaceEntityIds?: string[] },
    ) => {
      const stage = stageRef.current
      const entityMap = entityMapRef.current
      const connectionsList = connectionsRef.current

      if (!stage || !entityMap || !connectionsList) {
        return []
      }

      const rect = stage.getBoundingClientRect()
      const point = screenToBoard(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        rect,
        cameraRef.current,
      )

      const seed = factory(
        { x: point.x - 700, y: point.y - 440 },
        nextZIndex(entitiesRef.current),
      )

      const replaceEntityIds = new Set(options?.replaceEntityIds ?? [])
      const nextConnections = connectionsList
        .toArray()
        .map(parseBoardConnection)
        .filter((connection): connection is BoardConnection => connection !== null)
        .filter(
          (connection) =>
            !replaceEntityIds.has(connection.sourceEntityId) &&
            !replaceEntityIds.has(connection.targetEntityId),
        )

      entityMap.doc?.transact(() => {
        replaceEntityIds.forEach((entityId) => {
          entityMap.delete(entityId)
        })

        seed.entities.forEach((entity) => {
          entityMap.set(entity.id, serializeEntity(entity))
        })

        connectionsList.delete(0, connectionsList.length)
        connectionsList.push([
          ...nextConnections.map((connection) => serializeBoardConnection(connection)),
          ...seed.connections.map((connection) => serializeBoardConnection(connection)),
        ])
      })

      setSelectedEntityId(seed.entities[0]?.id ?? null)
      return seed.entities.map((entity) => entity.id)
    },
    [cameraRef, connectionsRef, entityMapRef, stageRef],
  )

  const updateEntity = useCallback(
    (entityId: string, updater: (entity: BoardEntity) => BoardEntity) => {
      const entityMap = entityMapRef.current

      if (!entityMap) {
        return
      }

      const current = parseEntity(entityMap.get(entityId))

      if (!current) {
        return
      }

      entityMap.set(entityId, serializeEntity(updater(current)))
    },
    [entityMapRef],
  )

  const deleteEntity = useCallback(
    (entityId: string) => {
      const entityMap = entityMapRef.current
      const connectionsList = connectionsRef.current

      if (!entityMap) {
        return
      }

      if (connectionsList) {
        const allConnections = connectionsList
          .toArray()
          .map(parseBoardConnection)
          .filter((connection): connection is BoardConnection => connection !== null)

        for (let index = allConnections.length - 1; index >= 0; index -= 1) {
          const connection = allConnections[index]

          if (
            connection.sourceEntityId === entityId ||
            connection.targetEntityId === entityId
          ) {
            connectionsList.delete(index, 1)
          }
        }
      }

      entityMap.delete(entityId)
      setSelectedEntityId((current) => (current === entityId ? null : current))
    },
    [connectionsRef, entityMapRef],
  )

  return {
    createBoardSeedAtViewportCenter,
    createEntitiesAtViewportCenter,
    createEntityAtViewportCenter,
    deleteEntity,
    entities,
    entitiesRef,
    selectedEntityId,
    setEntities,
    setSelectedEntityId,
    updateEntity,
  }
}

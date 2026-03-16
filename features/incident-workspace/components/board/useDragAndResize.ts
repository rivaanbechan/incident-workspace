"use client"

import type { BoardEntity, CameraState } from "@/features/incident-workspace/lib/board/types"
import {
  clamp,
  parseEntity,
  screenToBoard,
  serializeEntity,
} from "@/features/incident-workspace/components/board/boardCore"
import { useCallback, useEffect, useRef, useState } from "react"
import type * as Y from "yjs"
import type { WebsocketProvider } from "y-websocket"

type InteractionState =
  | {
      pointerId: number
      startX: number
      startY: number
      type: "pan"
      viewX: number
      viewY: number
    }
  | {
      entityIds: string[]
      origins: Record<string, { x: number; y: number }>
      pointerId: number
      startClientX: number
      startClientY: number
      type: "drag"
    }
  | {
      entityId: string
      originHeight: number
      originWidth: number
      pointerId: number
      startClientX: number
      startClientY: number
      type: "resize"
    }
  | null

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

type UseDragAndResizeArgs = {
  cameraRef: React.MutableRefObject<CameraState>
  entities: BoardEntity[]
  entityMapRef: React.MutableRefObject<Y.Map<string> | null>
  providerRef: React.MutableRefObject<InstanceType<typeof WebsocketProvider> | null>
  selectedEntityIds: string[]
  setCamera: (camera: CameraState | ((prev: CameraState) => CameraState)) => void
  stageRef: React.MutableRefObject<HTMLDivElement | null>
}

export function useDragAndResize({
  cameraRef,
  entities,
  entityMapRef,
  providerRef,
  selectedEntityIds,
  setCamera,
  stageRef,
}: UseDragAndResizeArgs) {
  const interactionRef = useRef<InteractionState>(null)
  const lastCursorSentAtRef = useRef(0)
  const [isPanning, setIsPanning] = useState(false)

  const beginEntityDrag = useCallback(
    (
      event: React.PointerEvent<HTMLElement | HTMLDivElement | HTMLButtonElement>,
      entityId: string,
    ) => {
      const draggedIds = selectedEntityIds.includes(entityId) ? selectedEntityIds : [entityId]

      const origins = draggedIds.reduce<Record<string, { x: number; y: number }>>(
        (result, currentEntityId) => {
          const currentEntity = entities.find((item) => item.id === currentEntityId)

          if (currentEntity) {
            result[currentEntityId] = {
              x: currentEntity.x,
              y: currentEntity.y,
            }
          }

          return result
        },
        {},
      )

      interactionRef.current = {
        entityIds: draggedIds,
        origins,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        type: "drag",
      }
    },
    [entities, selectedEntityIds],
  )

  useEffect(() => {
    const updatePresencePointer = (event: PointerEvent) => {
      const now = Date.now()

      if (now - lastCursorSentAtRef.current < 50) {
        return
      }

      const provider = providerRef.current
      const stage = stageRef.current

      if (!provider || !stage) {
        return
      }

      const rect = stage.getBoundingClientRect()

      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        return
      }

      lastCursorSentAtRef.current = now
      const nextCursor = screenToBoard(event.clientX, event.clientY, rect, cameraRef.current)

      provider.awareness.setLocalStateField("cursor", nextCursor)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current

      updatePresencePointer(event)

      if (!interaction || event.pointerId !== interaction.pointerId) {
        return
      }

      if (interaction.type === "pan") {
        setIsPanning(true)
        setCamera({
          x: interaction.viewX + event.clientX - interaction.startX,
          y: interaction.viewY + event.clientY - interaction.startY,
          zoom: cameraRef.current.zoom,
        })

        return
      }

      const entityMap = entityMapRef.current

      if (!entityMap) {
        return
      }

      if (interaction.type === "drag") {
        const dx = (event.clientX - interaction.startClientX) / cameraRef.current.zoom
        const dy = (event.clientY - interaction.startClientY) / cameraRef.current.zoom

        interaction.entityIds.forEach((entityId) => {
          const nextEntity = parseEntity(entityMap.get(entityId))
          const origin = interaction.origins[entityId]

          if (!nextEntity || !origin) {
            return
          }

          entityMap.set(
            nextEntity.id,
            serializeEntity({
              ...nextEntity,
              updatedAt: Date.now(),
              x: origin.x + dx,
              y: origin.y + dy,
            }),
          )
        })

        return
      }

      const current = parseEntity(entityMap.get(interaction.entityId))

      if (!current) {
        return
      }

      const nextWidth = clamp(
        interaction.originWidth +
          (event.clientX - interaction.startClientX) / cameraRef.current.zoom,
        current.type === "investigationZone" ? 320 : 180,
        current.type === "investigationZone" ? 8000 : 2400,
      )
      const nextHeight = clamp(
        interaction.originHeight +
          (event.clientY - interaction.startClientY) / cameraRef.current.zoom,
        current.type === "investigationZone"
          ? 220
          : current.type === "incidentCard"
            ? getMinimumIncidentCardHeight(current.mapKind)
            : current.type === "note"
              ? getMinimumNoteHeight(current.mapKind)
              : 120,
        current.type === "investigationZone" ? 5000 : 1800,
      )

      entityMap.set(
        current.id,
        serializeEntity({
          ...current,
          height: nextHeight,
          updatedAt: Date.now(),
          width: nextWidth,
        }),
      )
    }

    const handlePointerUp = (event: PointerEvent) => {
      const interaction = interactionRef.current

      if (!interaction || interaction.pointerId !== event.pointerId) {
        return
      }

      interactionRef.current = null
      setIsPanning(false)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [cameraRef, entityMapRef, providerRef, setCamera, stageRef])

  const handleResizeStart = useCallback(
    ({
      entityId,
      originHeight,
      originWidth,
      pointerId,
      startClientX,
      startClientY,
    }: {
      entityId: string
      originHeight: number
      originWidth: number
      pointerId: number
      startClientX: number
      startClientY: number
    }) => {
      interactionRef.current = {
        entityId,
        originHeight,
        originWidth,
        pointerId,
        startClientX,
        startClientY,
        type: "resize",
      }
    },
    [],
  )

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()

    const stage = stageRef.current

    if (!stage) {
      return
    }

    const rect = stage.getBoundingClientRect()

    setCamera((current) => {
      const nextZoom = clamp(current.zoom * (event.deltaY < 0 ? 1.08 : 0.92), 0.12, 3.2)
      const boardPoint = screenToBoard(event.clientX, event.clientY, rect, current)

      return {
        x: event.clientX - rect.left - boardPoint.x * nextZoom,
        y: event.clientY - rect.top - boardPoint.y * nextZoom,
        zoom: nextZoom,
      }
    })
  }

  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    interactionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      type: "pan",
      viewX: cameraRef.current.x,
      viewY: cameraRef.current.y,
    }
  }

  return { beginEntityDrag, handleResizeStart, handleWheel, isPanning, startPan }
}

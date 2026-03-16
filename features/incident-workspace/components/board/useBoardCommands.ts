"use client"

import type { BoardEntity, CameraState } from "@/features/incident-workspace/lib/board/types"
import type { Dispatch, RefObject, SetStateAction } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"

const PAN_STEP = 72
const ZOOM_IN_FACTOR = 1.12
const ZOOM_OUT_FACTOR = 0.9
const MIN_ZOOM = 0.12
const MAX_ZOOM = 3.2
type UseBoardCommandsInput = {
  activeScreenShareCount: number
  areZonesEditable: boolean
  createEvidence: () => void
  createHandoff: () => void
  createIncidentCard: () => void
  createNote: () => void
  createStatusMarker: () => void
  createZone: () => void
  deleteSelectedEntity: () => void
  entities: BoardEntity[]
  fitToScreen: () => void
  focusSelectedEntity: () => void
  isVisualMode: boolean
  openIndexedShare: (index: number) => void
  openActionBoard: () => void
  openFeed: () => void
  openShareGallery: () => void
  selectedEntityId: string | null
  setIsVisualMode: (isVisualMode: boolean) => void
  setCamera: Dispatch<SetStateAction<CameraState>>
  setSelectedEntityId: (entityId: string | null) => void
  stageRef: RefObject<HTMLDivElement | null>
  toggleZoneEditing: () => void
}

const SINGLE_ENTITY_PADDING_X = 160
const SINGLE_ENTITY_PADDING_Y = 132
const MIN_FOCUS_ZOOM = 0.58
const MAX_FOCUS_ZOOM = 1.9

function isEditingElement(target: EventTarget | null) {
  const element = target as HTMLElement | null
  const tagName = element?.tagName

  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    element?.isContentEditable === true
  )
}

function focusStage(stageRef: RefObject<HTMLDivElement | null>) {
  stageRef.current?.focus()
}

export function useBoardCommands({
  activeScreenShareCount,
  areZonesEditable,
  createEvidence,
  createHandoff,
  createIncidentCard,
  createNote,
  createStatusMarker,
  createZone,
  deleteSelectedEntity,
  entities,
  fitToScreen,
  focusSelectedEntity,
  isVisualMode,
  openIndexedShare,
  openActionBoard,
  openFeed,
  openShareGallery,
  selectedEntityId,
  setIsVisualMode,
  setCamera,
  setSelectedEntityId,
  stageRef,
  toggleZoneEditing,
}: UseBoardCommandsInput) {
  const [isBoardFocused, setIsBoardFocused] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  const orderedEntities = useMemo(
    () =>
      [...entities]
        .filter((entity) => areZonesEditable || entity.type !== "investigationZone")
        .sort((left, right) => left.zIndex - right.zIndex),
    [areZonesEditable, entities],
  )

  const focusEntity = useCallback(
    (entityId: string | null) => {
      setSelectedEntityId(entityId)

      if (!entityId) {
        return
      }

      const entity = orderedEntities.find((item) => item.id === entityId)
      const stage = stageRef.current

      if (!entity || !stage) {
        return
      }

      const rect = stage.getBoundingClientRect()
      const availableWidth = Math.max(rect.width - SINGLE_ENTITY_PADDING_X * 2, 220)
      const availableHeight = Math.max(rect.height - SINGLE_ENTITY_PADDING_Y * 2, 220)
      const targetZoom = Math.min(
        Math.max(
          Math.min(availableWidth / entity.width, availableHeight / entity.height),
          MIN_FOCUS_ZOOM,
        ),
        MAX_FOCUS_ZOOM,
      )
      const entityCenterX = entity.x + entity.width / 2
      const entityCenterY = entity.y + entity.height / 2

      setCamera({
        x: rect.width / 2 - entityCenterX * targetZoom,
        y: rect.height / 2 - entityCenterY * targetZoom,
        zoom: targetZoom,
      })
    },
    [orderedEntities, setCamera, setSelectedEntityId, stageRef],
  )

  useEffect(() => {
    const stage = stageRef.current

    if (!stage) {
      return
    }

    const handleFocusIn = () => {
      setIsBoardFocused(true)
    }

    const handleFocusOut = () => {
      window.requestAnimationFrame(() => {
        const activeElement = document.activeElement
        setIsBoardFocused(Boolean(activeElement && stage.contains(activeElement)))
      })
    }

    stage.addEventListener("focusin", handleFocusIn)
    stage.addEventListener("focusout", handleFocusOut)

    return () => {
      stage.removeEventListener("focusin", handleFocusIn)
      stage.removeEventListener("focusout", handleFocusOut)
    }
  }, [stageRef])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const stage = stageRef.current

      if (!stage) {
        return
      }

      const activeElement = document.activeElement
      const stageHasFocus = Boolean(activeElement && stage.contains(activeElement))

      if (!stageHasFocus) {
        return
      }

      if (event.key === "?") {
        event.preventDefault()
        setIsHelpOpen((current) => !current)
        return
      }

      if (isEditingElement(event.target)) {
        if (event.key === "Escape") {
          event.preventDefault()
          ;(event.target as HTMLElement | null)?.blur()
          setIsVisualMode(true)
          focusStage(stageRef)
        }

        return
      }

      if (!isVisualMode && event.key === "Escape") {
        event.preventDefault()
        setSelectedEntityId(null)
        setIsHelpOpen(false)
        setIsVisualMode(true)
        focusStage(stageRef)
        return
      }

      const currentIndex = orderedEntities.findIndex(
        (entity) => entity.id === selectedEntityId,
      )

      if (isVisualMode && /^[0-9]$/.test(event.key)) {
        const digit = Number(event.key)

        if (digit === 0) {
          if (activeScreenShareCount > 0) {
            event.preventDefault()
            openShareGallery()
          }
          return
        }

        if (digit <= activeScreenShareCount) {
          event.preventDefault()
          openIndexedShare(digit - 1)
        }
        return
      }

      switch (event.key) {
        case "q":
          event.preventDefault()
          createNote()
          break
        case "w":
          event.preventDefault()
          createIncidentCard()
          break
        case "e":
          event.preventDefault()
          createStatusMarker()
          break
        case "r":
          event.preventDefault()
          createEvidence()
          break
        case "t":
          event.preventDefault()
          createHandoff()
          break
        case "y":
          event.preventDefault()
          createZone()
          break
        case "d":
          event.preventDefault()
          toggleZoneEditing()
          break
        case "a":
          if (!isVisualMode) {
            return
          }
          event.preventDefault()
          openActionBoard()
          break
        case "f":
          if (!isVisualMode) {
            return
          }
          event.preventDefault()
          openFeed()
          break
        case "g":
          event.preventDefault()
          fitToScreen()
          break
        case "[":
          event.preventDefault()
          if (orderedEntities.length === 0) {
            return
          }
          focusEntity(
            orderedEntities[
              currentIndex <= 0 ? orderedEntities.length - 1 : currentIndex - 1
            ]?.id ?? null,
          )
          break
        case "]":
          event.preventDefault()
          if (orderedEntities.length === 0) {
            return
          }
          focusEntity(
            orderedEntities[
              currentIndex === -1 || currentIndex === orderedEntities.length - 1
                ? 0
                : currentIndex + 1
            ]?.id ?? null,
          )
          break
        case "Delete":
        case "Backspace":
          if (selectedEntityId) {
            event.preventDefault()
            deleteSelectedEntity()
          }
          break
        case "Escape":
          event.preventDefault()
          setSelectedEntityId(null)
          setIsHelpOpen(false)
          setIsVisualMode(true)
          focusStage(stageRef)
          break
        case "Enter":
          event.preventDefault()
          focusSelectedEntity()
          setIsVisualMode(false)
          if (!selectedEntityId) {
            focusStage(stageRef)
            return
          }
          {
            const selectedElement = stage.querySelector<HTMLElement>(
              `[data-entity-id="${selectedEntityId}"] input, [data-entity-id="${selectedEntityId}"] textarea, [data-entity-id="${selectedEntityId}"] select`,
            )

            selectedElement?.focus()
          }
          break
        case "ArrowLeft":
          event.preventDefault()
          setCamera((current) => ({ ...current, x: current.x + PAN_STEP }))
          break
        case "ArrowDown":
          event.preventDefault()
          setCamera((current) => ({ ...current, y: current.y - PAN_STEP }))
          break
        case "ArrowUp":
          event.preventDefault()
          setCamera((current) => ({ ...current, y: current.y + PAN_STEP }))
          break
        case "ArrowRight":
          event.preventDefault()
          setCamera((current) => ({ ...current, x: current.x - PAN_STEP }))
          break
        case "+":
        case "=":
          event.preventDefault()
          setCamera((current) => ({
            ...current,
            zoom: Math.min(current.zoom * ZOOM_IN_FACTOR, MAX_ZOOM),
          }))
          break
        case "-":
        case "_":
          event.preventDefault()
          setCamera((current) => ({
            ...current,
            zoom: Math.max(current.zoom * ZOOM_OUT_FACTOR, MIN_ZOOM),
          }))
          break
        default:
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [
    activeScreenShareCount,
    createEvidence,
    createHandoff,
    createIncidentCard,
    createNote,
    createStatusMarker,
    createZone,
    deleteSelectedEntity,
    orderedEntities,
    fitToScreen,
    focusSelectedEntity,
    focusEntity,
    isVisualMode,
    openIndexedShare,
    openActionBoard,
    openFeed,
    openShareGallery,
    selectedEntityId,
    setIsVisualMode,
    setCamera,
    setSelectedEntityId,
    stageRef,
    toggleZoneEditing,
  ])

  return {
    commandHints: [
      "q hypothesis",
      "w scope",
      "e blocker",
      "r evidence",
      "t handoff",
      "y zone",
      "d zones",
      "a actions",
      "f feed",
      "k quick capture",
      "0 gallery",
      "1-9 shares",
      "s workspace",
      "g fit view",
      "[ ] cycle",
      "arrows pan",
      "+ - zoom",
      "Enter edit",
      "Del remove",
      "? help",
    ],
    isBoardFocused,
    isHelpOpen,
    setIsHelpOpen,
  }
}

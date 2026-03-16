"use client"

import type { BoardEntity, CameraState, IncidentLogEntry } from "@/features/incident-workspace/lib/board/types"
import type { MainWorkspaceTab } from "@/features/incident-workspace/components/board/boardShellShared"
import { clamp } from "@/features/incident-workspace/components/board/boardCore"
import { useCallback, useEffect, useRef } from "react"

type UseViewportNavigationArgs = {
  activeMainTab: MainWorkspaceTab
  autoFitOnOpen: boolean
  entities: BoardEntity[]
  initialEntityFocus: { id: string; kind: string | null; label: string; value: string } | null
  initialTab: MainWorkspaceTab
  setActiveMainTab: React.Dispatch<React.SetStateAction<MainWorkspaceTab>>
  setCamera: (camera: CameraState | ((prev: CameraState) => CameraState)) => void
  setIncidentLogDraft: (value: string) => void
  setIncidentLogEntryType: (value: IncidentLogEntry["type"]) => void
  setSelectedEntityId: (entityId: string | null) => void
  stageRef: React.MutableRefObject<HTMLDivElement | null>
}

export function useViewportNavigation({
  activeMainTab,
  autoFitOnOpen,
  entities,
  initialEntityFocus,
  initialTab,
  setActiveMainTab,
  setCamera,
  setIncidentLogDraft,
  setIncidentLogEntryType,
  setSelectedEntityId,
  stageRef,
}: UseViewportNavigationArgs) {
  const hasAppliedInitialFitRef = useRef(false)
  const hasAppliedInitialEntityFocusRef = useRef(false)

  const focusEntityOnCanvas = useCallback(
    (entityId: string | null) => {
      if (!entityId) {
        return
      }

      const stage = stageRef.current
      const entity = entities.find((item) => item.id === entityId)

      if (!stage || !entity) {
        return
      }

      const rect = stage.getBoundingClientRect()
      const paddingX = 160
      const paddingY = 132
      const availableWidth = Math.max(rect.width - paddingX * 2, 220)
      const availableHeight = Math.max(rect.height - paddingY * 2, 220)
      const targetZoom = clamp(
        Math.min(availableWidth / entity.width, availableHeight / entity.height),
        0.58,
        1.9,
      )
      const entityCenterX = entity.x + entity.width / 2
      const entityCenterY = entity.y + entity.height / 2

      setCamera({
        x: rect.width / 2 - entityCenterX * targetZoom,
        y: rect.height / 2 - entityCenterY * targetZoom,
        zoom: targetZoom,
      })
    },
    [entities, setCamera, stageRef],
  )

  const fitCanvasToScreen = useCallback(() => {
    const stage = stageRef.current

    if (!stage || entities.length === 0) {
      return
    }

    const rect = stage.getBoundingClientRect()
    const minX = Math.min(...entities.map((entity) => entity.x))
    const minY = Math.min(...entities.map((entity) => entity.y))
    const maxX = Math.max(...entities.map((entity) => entity.x + entity.width))
    const maxY = Math.max(...entities.map((entity) => entity.y + entity.height))
    const boundsWidth = Math.max(maxX - minX, 1)
    const boundsHeight = Math.max(maxY - minY, 1)
    const padding = 96
    const availableWidth = Math.max(rect.width - padding * 2, 160)
    const availableHeight = Math.max(rect.height - padding * 2, 160)
    const nextZoom = clamp(
      Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight) * 0.94,
      0.12,
      3.2,
    )
    const centeredWidth = boundsWidth * nextZoom
    const centeredHeight = boundsHeight * nextZoom

    setCamera({
      x: padding + (availableWidth - centeredWidth) / 2 - minX * nextZoom,
      y: padding + (availableHeight - centeredHeight) / 2 - minY * nextZoom,
      zoom: nextZoom,
    })
  }, [entities, setCamera, stageRef])

  // Auto-fit on open
  useEffect(() => {
    if (!autoFitOnOpen || initialTab !== "canvas") {
      hasAppliedInitialFitRef.current = false
      return
    }

    if (hasAppliedInitialFitRef.current || activeMainTab !== "canvas" || entities.length === 0) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      fitCanvasToScreen()
      hasAppliedInitialFitRef.current = true
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [activeMainTab, autoFitOnOpen, entities.length, fitCanvasToScreen, initialTab])

  // Initial entity focus
  useEffect(() => {
    if (
      !initialEntityFocus ||
      hasAppliedInitialEntityFocusRef.current ||
      (activeMainTab !== "canvas" && activeMainTab !== "feed")
    ) {
      return
    }

    if (activeMainTab === "feed") {
      hasAppliedInitialEntityFocusRef.current = true
      setIncidentLogEntryType("update")
      setIncidentLogDraft(
        `Entity context: ${initialEntityFocus.label}\nObserved signal:\nWhy it matters:\nNext step:`,
      )
      return
    }

    if (entities.length === 0) {
      return
    }

    const labelNeedle = initialEntityFocus.label.trim().toLowerCase()
    const valueNeedle = initialEntityFocus.value.trim().toLowerCase()
    const matched = entities.find((entity) => {
      const title =
        "title" in entity && typeof entity.title === "string" ? entity.title.toLowerCase() : ""
      const body =
        "body" in entity && typeof entity.body === "string" ? entity.body.toLowerCase() : ""
      const label =
        "label" in entity && typeof entity.label === "string" ? entity.label.toLowerCase() : ""

      return (
        title.includes(labelNeedle) ||
        body.includes(labelNeedle) ||
        label.includes(labelNeedle) ||
        title.includes(valueNeedle) ||
        body.includes(valueNeedle) ||
        label.includes(valueNeedle)
      )
    })

    hasAppliedInitialEntityFocusRef.current = true

    if (matched) {
      setSelectedEntityId(matched.id)
      focusEntityOnCanvas(matched.id)
      return
    }

    setActiveMainTab("feed")
  }, [
    activeMainTab,
    entities,
    focusEntityOnCanvas,
    initialEntityFocus,
    setActiveMainTab,
    setIncidentLogDraft,
    setIncidentLogEntryType,
    setSelectedEntityId,
  ])

  return { fitCanvasToScreen, focusEntityOnCanvas }
}

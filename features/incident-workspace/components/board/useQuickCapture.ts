"use client"

import type { IncidentLogEntry } from "@/features/incident-workspace/lib/board/types"
import type { QuickCaptureMode } from "@/features/incident-workspace/components/board/boardShellShared"
import { useToast } from "@/components/shell/ToastProvider"
import { useCallback, useEffect, useState } from "react"

type UseQuickCaptureArgs = {
  addPreparedIncidentLogEntry: (entry: {
    body: string
    linkedEntityIds?: string[]
    type: IncidentLogEntry["type"]
  }) => void
  createActionItem: (
    title: string,
    options?: { linkedEntityIds?: string[] },
  ) => void
  selectedEntityId: string | null
  stageRef: React.RefObject<HTMLElement | null>
}

export function useQuickCapture({
  addPreparedIncidentLogEntry,
  createActionItem,
  selectedEntityId,
  stageRef,
}: UseQuickCaptureArgs) {
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false)
  const [quickCaptureDraft, setQuickCaptureDraft] = useState("")
  const [quickCaptureMode, setQuickCaptureMode] = useState<QuickCaptureMode>("timeline")
  const [quickCaptureTimelineType, setQuickCaptureTimelineType] =
    useState<IncidentLogEntry["type"]>("update")
  const { showToast } = useToast()

  const resetQuickCapture = useCallback(() => {
    setQuickCaptureDraft("")
    setQuickCaptureMode("timeline")
    setQuickCaptureTimelineType("update")
  }, [])

  const closeQuickCapture = useCallback(() => {
    setIsQuickCaptureOpen(false)
    resetQuickCapture()
    window.requestAnimationFrame(() => {
      stageRef.current?.focus()
    })
  }, [resetQuickCapture, stageRef])

  const submitQuickCapture = useCallback(() => {
    const body = quickCaptureDraft.trim()

    if (!body) {
      return
    }

    if (quickCaptureMode === "timeline") {
      addPreparedIncidentLogEntry({
        body,
        linkedEntityIds: selectedEntityId ? [selectedEntityId] : undefined,
        type: quickCaptureTimelineType,
      })
      showToast({ message: "Timeline entry added.", tone: "success" })
    } else {
      createActionItem(body, {
        linkedEntityIds: selectedEntityId ? [selectedEntityId] : undefined,
      })
      showToast({ message: "Action created.", tone: "success" })
    }

    closeQuickCapture()
  }, [
    addPreparedIncidentLogEntry,
    closeQuickCapture,
    createActionItem,
    quickCaptureDraft,
    quickCaptureMode,
    quickCaptureTimelineType,
    selectedEntityId,
    showToast,
  ])

  useEffect(() => {
    const isEditingTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null
      const tagName = element?.tagName

      return (
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        element?.isContentEditable === true
      )
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        return
      }

      if (isEditingTarget(event.target)) {
        return
      }

      if (event.key.toLowerCase() !== "k") {
        return
      }

      if (isQuickCaptureOpen) {
        return
      }

      event.preventDefault()
      setIsQuickCaptureOpen(true)
      setQuickCaptureDraft("")
      setQuickCaptureMode("timeline")
      setQuickCaptureTimelineType("update")
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isQuickCaptureOpen])

  return {
    isQuickCaptureOpen,
    quickCaptureDraft,
    quickCaptureMode,
    quickCaptureTimelineType,
    setQuickCaptureDraft,
    setQuickCaptureMode,
    setQuickCaptureTimelineType,
    closeQuickCapture,
    submitQuickCapture,
  }
}

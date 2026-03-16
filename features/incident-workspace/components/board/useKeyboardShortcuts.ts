"use client"

import type { MainWorkspaceTab } from "@/features/incident-workspace/components/board/boardShellShared"
import { isEditingElement } from "@/features/incident-workspace/components/board/boardShellShared"
import { useEffect } from "react"

type UseKeyboardShortcutsArgs = {
  activeMainTab: MainWorkspaceTab
  isRoomVisualMode: boolean
  setActiveMainTab: React.Dispatch<React.SetStateAction<MainWorkspaceTab>>
  setIsBoardFullscreen: React.Dispatch<React.SetStateAction<boolean>>
  setIsRoomVisualMode: (value: boolean) => void
}

export function useKeyboardShortcuts({
  activeMainTab,
  isRoomVisualMode,
  setActiveMainTab,
  setIsBoardFullscreen,
  setIsRoomVisualMode,
}: UseKeyboardShortcutsArgs) {
  // Escape on canvas tab → set visual mode
  useEffect(() => {
    if (activeMainTab !== "canvas") {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isEditingElement(event.target)) {
        return
      }

      setIsRoomVisualMode(true)
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [activeMainTab, setIsRoomVisualMode])

  // Escape on non-canvas tab → navigate back/visual mode
  useEffect(() => {
    if (activeMainTab === "canvas") {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isEditingElement(event.target)) {
        return
      }

      event.preventDefault()

      if (isRoomVisualMode) {
        setActiveMainTab("canvas")
        return
      }

      setIsRoomVisualMode(true)
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [activeMainTab, isRoomVisualMode, setActiveMainTab, setIsRoomVisualMode])

  // Tab key (in visual mode) → cycle tabs
  useEffect(() => {
    const orderedTabs: MainWorkspaceTab[] = ["canvas", "actions", "feed", "search"]

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Tab" ||
        event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !isRoomVisualMode
      ) {
        return
      }

      if (isEditingElement(event.target)) {
        return
      }

      event.preventDefault()
      setActiveMainTab((current) => {
        const currentIndex = orderedTabs.indexOf(current)

        if (currentIndex === -1) {
          return "canvas"
        }

        return orderedTabs[(currentIndex + 1) % orderedTabs.length]
      })
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isRoomVisualMode, setActiveMainTab])

  // a/c/f/s letter keys (in visual mode) → open tab
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isRoomVisualMode || isEditingElement(event.target)) {
        return
      }

      if (event.key === "a") {
        event.preventDefault()
        setActiveMainTab("actions")
        return
      }

      if (event.key === "c") {
        event.preventDefault()
        setActiveMainTab("canvas")
        return
      }

      if (event.key === "f") {
        event.preventDefault()
        setActiveMainTab("feed")
        return
      }

      if (event.key === "s") {
        event.preventDefault()
        setActiveMainTab("search")
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isRoomVisualMode, setActiveMainTab])

  // s key (no modifier) → toggle fullscreen
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "s" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        isEditingElement(event.target)
      ) {
        return
      }

      event.preventDefault()
      setIsBoardFullscreen((current) => !current)
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [setIsBoardFullscreen])
}

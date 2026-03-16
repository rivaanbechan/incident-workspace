"use client"

import type {
  ActiveScreenShare,
  LiveShareView,
} from "@/features/incident-workspace/components/livekit/LiveSessionPanel"
import type { MainWorkspaceTab } from "@/features/incident-workspace/components/board/boardShellShared"
import { isEditingElement } from "@/features/incident-workspace/components/board/boardShellShared"
import { useEffect, useState } from "react"

type UseScreenSharesArgs = {
  activeMainTab: MainWorkspaceTab
}

export function useScreenShares({ activeMainTab }: UseScreenSharesArgs) {
  const [activeScreenShares, setActiveScreenShares] = useState<ActiveScreenShare[]>([])
  const [activeShareView, setActiveShareView] = useState<LiveShareView>({ mode: "none" })

  const openShareGallery = () => {
    if (activeScreenShares.length === 0) {
      return
    }

    setActiveShareView({ mode: "gallery" })
  }

  const openIndexedShare = (index: number) => {
    const share = activeScreenShares[index]

    if (!share) {
      return
    }

    setActiveShareView({
      mode: "focused",
      openedFromGallery: activeShareView.mode === "gallery",
      trackId: share.trackId,
    })
  }

  useEffect(() => {
    if (activeMainTab !== "canvas" || activeShareView.mode === "none") {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditingElement(event.target)) {
        return
      }

      if (event.key === "Escape") {
        event.preventDefault()
        setActiveShareView((current) =>
          current.mode === "focused"
            ? current.openedFromGallery
              ? { mode: "gallery" }
              : { mode: "none" }
            : { mode: "none" },
        )
        return
      }

      if (!/^[0-9]$/.test(event.key)) {
        return
      }

      const digit = Number(event.key)

      if (digit === 0) {
        if (activeScreenShares.length > 0) {
          event.preventDefault()
          setActiveShareView({ mode: "gallery" })
        }
        return
      }

      if (digit <= activeScreenShares.length) {
        const share = activeScreenShares[digit - 1]

        if (!share) {
          return
        }

        event.preventDefault()
        setActiveShareView({
          mode: "focused",
          openedFromGallery: false,
          trackId: share.trackId,
        })
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [activeMainTab, activeScreenShares, activeShareView.mode])

  return {
    activeScreenShares,
    setActiveScreenShares,
    activeShareView,
    setActiveShareView,
    openShareGallery,
    openIndexedShare,
  }
}

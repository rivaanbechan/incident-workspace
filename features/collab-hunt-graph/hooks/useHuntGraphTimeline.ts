"use client"

import type { HuntGraphEdge, HuntGraphNode } from "@/features/collab-hunt-graph/lib/types"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export type UseHuntGraphTimelineReturn = {
  availableTimeRange: { min: number; max: number } | null
  hasTimeData: boolean
  isPlaying: boolean
  pause: () => void
  play: () => void
  scrubberValue: number
  setScrubberValue: (value: number) => void
  visibleUpTo: number | null
}

const PLAY_SPEED_MS = 150

export function useHuntGraphTimeline(
  nodes: HuntGraphNode[],
  edges: HuntGraphEdge[],
  timeField: string | null,
): UseHuntGraphTimelineReturn {
  const [scrubberValue, setScrubberValue] = useState(100)
  const [isPlaying, setIsPlaying] = useState(false)
  const playFrameRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Collect all discoveredAt timestamps from nodes and edges
  const availableTimeRange = useMemo(() => {
    if (!timeField) return null

    const timestamps: number[] = []

    nodes.forEach((n) => { if (n.discoveredAt !== null) timestamps.push(n.discoveredAt) })
    edges.forEach((e) => { if (e.discoveredAt !== null) timestamps.push(e.discoveredAt) })

    if (timestamps.length === 0) return null

    return {
      max: Math.max(...timestamps),
      min: Math.min(...timestamps),
    }
  }, [nodes, edges, timeField])

  const hasTimeData = availableTimeRange !== null

  // Convert scrubber (0–100) to an absolute timestamp
  const visibleUpTo = useMemo(() => {
    if (!availableTimeRange) return null
    const { min, max } = availableTimeRange
    if (min === max) return max
    return min + ((max - min) * scrubberValue) / 100
  }, [availableTimeRange, scrubberValue])

  const pause = useCallback(() => {
    setIsPlaying(false)
    if (playFrameRef.current) {
      clearTimeout(playFrameRef.current)
      playFrameRef.current = null
    }
  }, [])

  const play = useCallback(() => {
    if (!hasTimeData) return
    setIsPlaying(true)
    setScrubberValue((prev) => (prev >= 100 ? 0 : prev))
  }, [hasTimeData])

  // Advance scrubber while playing
  useEffect(() => {
    if (!isPlaying) return

    const advance = () => {
      setScrubberValue((prev) => {
        if (prev >= 100) {
          setIsPlaying(false)
          return 100
        }
        return Math.min(prev + 1, 100)
      })
    }

    playFrameRef.current = setTimeout(advance, PLAY_SPEED_MS)

    return () => {
      if (playFrameRef.current) clearTimeout(playFrameRef.current)
    }
  }, [isPlaying, scrubberValue])

  // Stop playing when time data disappears
  useEffect(() => {
    if (!hasTimeData && isPlaying) pause()
  }, [hasTimeData, isPlaying, pause])

  return {
    availableTimeRange,
    hasTimeData,
    isPlaying,
    pause,
    play,
    scrubberValue,
    setScrubberValue,
    visibleUpTo,
  }
}

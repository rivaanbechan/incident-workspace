"use client"

import {
  buildLayoutSettings,
  hideAllEdges,
  preSpreadNodes,
  runLayoutStep,
  showAllEdges,
  snapshotNodePositions,
} from "@/features/collab-hunt-graph/lib/graphLayout"
import type Graph from "graphology"
import { useCallback, useEffect, useRef, useState } from "react"
import type Sigma from "sigma"

export type UseHuntGraphLayoutReturn = {
  isLayoutRunning: boolean
  toggleLayout: () => void
  registerCanvas: (sigma: Sigma, graph: Graph) => void
  unregisterCanvas: () => void
}

export function useHuntGraphLayout(): UseHuntGraphLayoutReturn {
  const sigmaRef = useRef<Sigma | null>(null)
  const graphRef = useRef<Graph | null>(null)
  const frameRef = useRef<number>(0)
  const settingsRef = useRef<ReturnType<typeof buildLayoutSettings> | null>(null)
  const [isLayoutRunning, setIsLayoutRunning] = useState(false)

  const stopLayout = useCallback(() => {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
    }

    const graph = graphRef.current
    const sigma = sigmaRef.current
    if (graph && sigma) {
      showAllEdges(graph)
      sigma.refresh()
    }

    setIsLayoutRunning(false)
  }, [])

  const startLayout = useCallback(() => {
    const sigma = sigmaRef.current
    const graph = graphRef.current

    if (!sigma || !graph || graph.order < 2) return

    // Pre-spread nodes to a large circle so FA2 has room to work.
    // Without this, all nodes start near the origin and the algorithm
    // produces tightly packed, unreadable clusters.
    preSpreadNodes(graph)

    // Build settings tuned to this specific graph's size/density.
    const settings = buildLayoutSettings(graph)
    settingsRef.current = settings

    // Hide edges during layout for performance on large graphs.
    hideAllEdges(graph)
    sigma.refresh()
    setIsLayoutRunning(true)

    const animate = () => {
      if (!sigmaRef.current || !graphRef.current || !settingsRef.current) return
      runLayoutStep(graphRef.current, sigmaRef.current, settingsRef.current)
      frameRef.current = window.requestAnimationFrame(animate)
    }

    frameRef.current = window.requestAnimationFrame(animate)
  }, [])

  const toggleLayout = useCallback(() => {
    if (isLayoutRunning) {
      stopLayout()
    } else {
      startLayout()
    }
  }, [isLayoutRunning, startLayout, stopLayout])

  const registerCanvas = useCallback((sigma: Sigma, graph: Graph) => {
    sigmaRef.current = sigma
    graphRef.current = graph
  }, [])

  const unregisterCanvas = useCallback(() => {
    // Clear refs first — stopLayout checks them before calling sigma.refresh(),
    // so nulling them prevents refreshing an already-killed Sigma instance.
    sigmaRef.current = null
    graphRef.current = null
    settingsRef.current = null
    stopLayout()
  }, [stopLayout])

  // Expose position snapshot for consumers that want to persist positions
  const getPositionSnapshot = useCallback(() => {
    if (!graphRef.current) return new Map<string, { x: number; y: number }>()
    return snapshotNodePositions(graphRef.current)
  }, [])

  useEffect(() => {
    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
    }
  }, [])

  void getPositionSnapshot

  return {
    isLayoutRunning,
    registerCanvas,
    toggleLayout,
    unregisterCanvas,
  }
}

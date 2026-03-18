"use client"

import type { HuntGraphRoom } from "@/features/collab-hunt-graph/hooks/useHuntGraphRoom"
import type { HuntGraphEdge, HuntGraphNode } from "@/features/collab-hunt-graph/lib/types"
import { EmptyState } from "@/components/shell/EmptyState"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EdgeCurvedArrowProgram, indexParallelEdgesIndex } from "@sigma/edge-curve"
import Graph from "graphology"
import { useEffect, useRef } from "react"
import Sigma from "sigma"
import { NodeCircleProgram } from "sigma/rendering"

type HuntGraphCanvasProps = {
  edges: HuntGraphEdge[]
  isLayoutRunning: boolean
  nodes: HuntGraphNode[]
  onEdgeClick: (edgeId: string) => void
  onNodeClick: (nodeId: string) => void
  onStageClick: () => void
  pinnedEdgeIds: string[]
  pinnedNodeIds: string[]
  registerCanvas: HuntGraphRoom["layout"]["registerCanvas"]
  selectedEdgeId: string | null
  selectedNodeId: string | null
  statusMessage: string
  toggleLayout: () => void
  unregisterCanvas: HuntGraphRoom["layout"]["unregisterCanvas"]
}

function resolveNodeColor(
  node: HuntGraphNode,
  selectedNodeId: string | null,
  pinnedSet: Set<string>,
): string {
  if (selectedNodeId === node.id) return "hsl(var(--critical))"
  if (pinnedSet.has(node.id)) return "hsl(var(--foreground))"
  return node.color
}

function resolveEdgeColor(
  edge: HuntGraphEdge,
  selectedEdgeId: string | null,
  pinnedSet: Set<string>,
): string {
  if (selectedEdgeId === edge.id) return "hsl(var(--critical))"
  if (pinnedSet.has(edge.id)) return "hsl(var(--foreground))"
  return edge.color
}

export function HuntGraphCanvas({
  edges,
  isLayoutRunning,
  nodes,
  onEdgeClick,
  onNodeClick,
  onStageClick,
  pinnedEdgeIds,
  pinnedNodeIds,
  registerCanvas,
  selectedEdgeId,
  selectedNodeId,
  statusMessage,
  toggleLayout,
  unregisterCanvas,
}: HuntGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sigmaRef = useRef<Sigma | null>(null)

  const pinnedNodeSet = new Set(pinnedNodeIds)
  const pinnedEdgeSet = new Set(pinnedEdgeIds)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (nodes.length === 0) {
      sigmaRef.current?.kill()
      sigmaRef.current = null
      unregisterCanvas()
      container.innerHTML = ""
      return
    }

    // Use a multi-graph so parallel edges (A→B and B→A, or duplicate A→B)
    // are preserved as separate edges rather than collapsed.
    const graph = new Graph({ multi: true, type: "directed" })

    nodes.forEach((node, index) => {
      graph.addNode(node.id, {
        color: resolveNodeColor(node, selectedNodeId, pinnedNodeSet),
        label: node.label,
        size: pinnedNodeSet.has(node.id) ? node.size + 3 : node.size,
        x: node.x ?? Math.cos(index) * 10,
        y: node.y ?? Math.sin(index) * 10,
      })
    })

    edges.forEach((edge) => {
      if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) return
      if (edge.source === edge.target) return

      graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
        color: resolveEdgeColor(edge, selectedEdgeId, pinnedEdgeSet),
        label: edge.label,
        size: pinnedEdgeSet.has(edge.id) ? edge.weight + 1 : edge.weight,
        type: "curved",
      })
    })

    // Assign curvature values to parallel edges between the same node pair
    // so they fan out visibly instead of overlapping.
    indexParallelEdgesIndex(graph, { edgeIndexAttribute: "parallelIndex", edgeMinIndexAttribute: "parallelMinIndex" })
    graph.forEachEdge((edgeId, attrs) => {
      if (typeof attrs.parallelIndex === "number") {
        const curvature = attrs.parallelIndex !== 0
          ? 0.25 + (attrs.parallelIndex - 1) * 0.15
          : 0
        graph.setEdgeAttribute(edgeId, "curvature", curvature)
      }
    })

    sigmaRef.current?.kill()
    const sigma = new Sigma(graph, container, {
      allowInvalidContainer: true,
      defaultEdgeType: "curved",
      defaultNodeType: "circle",
      edgeProgramClasses: { curved: EdgeCurvedArrowProgram },
      labelRenderedSizeThreshold: 8,
      nodeProgramClasses: { circle: NodeCircleProgram },
      renderEdgeLabels: false,
      renderLabels: true,
    })

    sigma.on("clickNode", ({ node }) => { onNodeClick(node) })
    sigma.on("clickEdge", ({ edge }) => { onEdgeClick(edge) })
    sigma.on("clickStage", () => { onStageClick() })

    sigmaRef.current = sigma
    registerCanvas(sigma, graph)

    return () => {
      // Unregister first (clears layout refs) before killing Sigma,
      // so stopLayout never calls sigma.refresh() on a dead instance.
      if (sigmaRef.current === sigma) {
        sigmaRef.current = null
        unregisterCanvas()
      }
      sigma.kill()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, selectedNodeId, selectedEdgeId, pinnedNodeIds, pinnedEdgeIds])

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {nodes.length} nodes · {edges.length} edges
          </Badge>
          {isLayoutRunning && (
            <Badge className="bg-info/15 text-info text-xs">Layout running</Badge>
          )}
        </div>
        <Button
          disabled={nodes.length < 2}
          onClick={toggleLayout}
          size="sm"
          type="button"
          variant={isLayoutRunning ? "default" : "outline"}
        >
          {isLayoutRunning ? "Stop Layout" : "Run ForceAtlas2"}
        </Button>
      </div>

      <div
        ref={containerRef}
        className="relative min-h-[520px] overflow-hidden rounded-2xl border border-border/70"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, hsl(var(--info) / 0.06), transparent 30%), hsl(var(--card))",
        }}
      />

      {nodes.length === 0 && (
        <EmptyState message={statusMessage} />
      )}
    </div>
  )
}

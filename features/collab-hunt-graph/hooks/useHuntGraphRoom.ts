"use client"

import { buildNodesAndEdgesFromRows } from "@/features/collab-hunt-graph/lib/graphBuilder"
import type {
  HuntGraphSnapshot,
  SavedHuntGraphViewDetail,
} from "@/features/collab-hunt-graph/lib/types"
import type { CaseAccessContext } from "@/lib/auth/permissions"
import { useMemo, useState } from "react"
import { useHuntGraphDatasource } from "./useHuntGraphDatasource"
import { useHuntGraphGraph } from "./useHuntGraphGraph"
import { useHuntGraphLayout } from "./useHuntGraphLayout"
import { useHuntGraphTimeline } from "./useHuntGraphTimeline"
import { useHuntGraphYjs } from "./useHuntGraphYjs"

export type HuntGraphRoom = ReturnType<typeof useHuntGraphRoom>

export function useHuntGraphRoom(
  roomId: string,
  initialView: SavedHuntGraphViewDetail | null,
  currentUser: Pick<CaseAccessContext, "name">,
) {
  const [userName] = useState(currentUser.name)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [graphStatusMessage, setGraphStatusMessage] = useState(
    "Load a datasource result to build the shared graph.",
  )

  const yjs = useHuntGraphYjs(roomId, initialView)

  const datasource = useHuntGraphDatasource(
    yjs.datasourceId,
    yjs.query,
    yjs.columnMapping,
    yjs.timeField,
  )

  const layout = useHuntGraphLayout()

  const timeline = useHuntGraphTimeline(yjs.nodes, yjs.edges, yjs.timeField)

  const graph = useHuntGraphGraph(
    yjs.nodes,
    yjs.edges,
    yjs.notes,
    yjs.filters,
    yjs.pinnedNodeIds,
    yjs.pinnedEdgeIds,
    timeline.visibleUpTo,
    yjs.maps,
  )

  const selectedNode = useMemo(
    () => yjs.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [yjs.nodes, selectedNodeId],
  )
  const selectedEdge = useMemo(
    () => yjs.edges.find((e) => e.id === selectedEdgeId) ?? null,
    [yjs.edges, selectedEdgeId],
  )
  const selectedNotes = useMemo(() => {
    if (selectedNodeId) return yjs.notes.filter((n) => n.targetType === "node" && n.targetId === selectedNodeId)
    if (selectedEdgeId) return yjs.notes.filter((n) => n.targetType === "edge" && n.targetId === selectedEdgeId)
    return []
  }, [yjs.notes, selectedNodeId, selectedEdgeId])

  const buildGraph = async () => {
    const { columnMapping, rows, timeField: tf } = datasource
    if (!columnMapping) {
      setGraphStatusMessage("Map source and destination columns before building the graph.")
      return
    }
    if (rows.length === 0) {
      setGraphStatusMessage("Run a query before building the graph.")
      return
    }

    const { nodes, edges } = buildNodesAndEdgesFromRows({
      columnMapping,
      depth: 0,
      origin: "original",
      parentId: null,
      rows,
      timeField: tf,
    })

    const snapshot: HuntGraphSnapshot = {
      activeSavedViewId: null,
      adapterId: yjs.adapterId,
      columnMapping,
      datasourceId: datasource.datasourceId || null,
      edges,
      filters: { edgeKinds: [], nodeKinds: [] },
      nodes,
      notes: [],
      pinnedEdgeIds: [],
      pinnedNodeIds: [],
      query: datasource.query,
      timeField: tf,
    }

    yjs.applySnapshot(snapshot)
    setGraphStatusMessage(`Built graph: ${nodes.length} nodes, ${edges.length} edges.`)
  }

  const expandSelectedNode = async () => {
    if (!selectedNode) {
      setGraphStatusMessage("Select a node to expand.")
      return
    }
    const { columnMapping, rows, timeField: tf } = datasource
    if (!columnMapping) {
      setGraphStatusMessage("Column mapping is required for expansion.")
      return
    }

    // Re-query using the selected node's label as the pivot search term
    datasource.setQuery(selectedNode.label)
    const result = await datasource.runQuery()
    if (!result || result.rows.length === 0) return

    const { nodes, edges } = buildNodesAndEdgesFromRows({
      columnMapping,
      depth: selectedNode.depth + 1,
      origin: "expanded",
      parentId: selectedNode.id,
      rows: result.rows,
      timeField: tf,
    })

    graph.mergeGraphData(nodes, edges)
    setGraphStatusMessage(`Expanded "${selectedNode.label}": ${nodes.length} new nodes.`)
  }

  const snapshot = useMemo(
    (): HuntGraphSnapshot => ({
      activeSavedViewId: yjs.activeSavedViewId,
      adapterId: yjs.adapterId,
      columnMapping: yjs.columnMapping,
      datasourceId: yjs.datasourceId,
      edges: yjs.edges,
      filters: yjs.filters,
      nodes: yjs.nodes,
      notes: yjs.notes,
      pinnedEdgeIds: yjs.pinnedEdgeIds,
      pinnedNodeIds: yjs.pinnedNodeIds,
      query: datasource.query,
      timeField: yjs.timeField,
    }),
    [yjs, datasource.query],
  )

  return {
    // Identity
    userName,
    roomId,
    // Yjs
    connectionStatus: yjs.connectionStatus,
    activeSavedViewId: yjs.activeSavedViewId,
    applySnapshot: yjs.applySnapshot,
    snapshot,
    // Datasource
    datasource,
    // Graph state
    ...graph,
    nodes: yjs.nodes,
    edges: yjs.edges,
    notes: yjs.notes,
    pinnedNodeIds: yjs.pinnedNodeIds,
    pinnedEdgeIds: yjs.pinnedEdgeIds,
    filters: yjs.filters,
    // Selection
    selectedNode,
    selectedEdge,
    selectedNodeId,
    selectedEdgeId,
    selectedNotes,
    setSelectedNodeId,
    setSelectedEdgeId,
    // Actions
    buildGraph,
    expandSelectedNode,
    graphStatusMessage,
    // Layout
    layout,
    // Timeline
    timeline,
  }
}

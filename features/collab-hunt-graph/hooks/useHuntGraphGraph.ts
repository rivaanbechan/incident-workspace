"use client"

import {
  deduplicateEdges,
  deduplicateNodes,
  getDescendantIds,
} from "@/features/collab-hunt-graph/lib/graphBuilder"
import type {
  HuntGraphEdge,
  HuntGraphFilters,
  HuntGraphNode,
  HuntGraphNote,
} from "@/features/collab-hunt-graph/lib/types"
import { useCallback, useMemo } from "react"
import type * as Y from "yjs"

type YjsMaps = {
  nodesMap: Y.Map<string>
  edgesMap: Y.Map<string>
  notesMap: Y.Map<string>
  pinnedNodesMap: Y.Map<string>
  pinnedEdgesMap: Y.Map<string>
  metaMap: Y.Map<string>
  filtersMap: Y.Map<string>
}

export type UseHuntGraphGraphReturn = {
  availableEdgeKinds: HuntGraphEdge["kind"][]
  availableNodeKinds: HuntGraphNode["kind"][]
  filteredEdges: HuntGraphEdge[]
  filteredNodes: HuntGraphNode[]
  mergeGraphData: (nodes: HuntGraphNode[], edges: HuntGraphEdge[]) => void
  deleteNode: (nodeId: string, recursive: boolean) => void
  togglePinnedNode: (nodeId: string) => void
  togglePinnedEdge: (edgeId: string) => void
  addNote: (body: string, selectedNodeId: string | null, selectedEdgeId: string | null, userName: string) => void
  setFilters: (filters: HuntGraphFilters) => void
  setNodeKindEnabled: (kind: HuntGraphNode["kind"], enabled: boolean) => void
  setEdgeKindEnabled: (kind: HuntGraphEdge["kind"], enabled: boolean) => void
}

export function useHuntGraphGraph(
  nodes: HuntGraphNode[],
  edges: HuntGraphEdge[],
  notes: HuntGraphNote[],
  filters: HuntGraphFilters,
  pinnedNodeIds: string[],
  pinnedEdgeIds: string[],
  visibleUpTo: number | null,
  maps: YjsMaps | null,
): UseHuntGraphGraphReturn {
  const availableNodeKinds = useMemo(
    () => Array.from(new Set(nodes.map((n) => n.kind))).sort(),
    [nodes],
  )
  const availableEdgeKinds = useMemo(
    () => Array.from(new Set(edges.map((e) => e.kind))).sort(),
    [edges],
  )

  const visibleNodeKinds =
    filters.nodeKinds.length > 0 ? filters.nodeKinds : availableNodeKinds
  const visibleEdgeKinds =
    filters.edgeKinds.length > 0 ? filters.edgeKinds : availableEdgeKinds

  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      if (!visibleNodeKinds.includes(node.kind)) return false
      if (visibleUpTo !== null && node.discoveredAt !== null && node.discoveredAt > visibleUpTo) {
        return false
      }
      return true
    })
  }, [nodes, visibleNodeKinds, visibleUpTo])

  const filteredNodeIdSet = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes],
  )

  const filteredEdges = useMemo(() => {
    return edges.filter((edge) => {
      if (!visibleEdgeKinds.includes(edge.kind)) return false
      if (!filteredNodeIdSet.has(edge.source) || !filteredNodeIdSet.has(edge.target)) return false
      if (visibleUpTo !== null && edge.discoveredAt !== null && edge.discoveredAt > visibleUpTo) {
        return false
      }
      return true
    })
  }, [edges, filteredNodeIdSet, visibleEdgeKinds, visibleUpTo])

  const mergeGraphData = useCallback(
    (incomingNodes: HuntGraphNode[], incomingEdges: HuntGraphEdge[]) => {
      if (!maps) return
      const merged = {
        nodes: deduplicateNodes(nodes, incomingNodes),
        edges: deduplicateEdges(edges, incomingEdges),
      }
      maps.nodesMap.doc?.transact(() => {
        merged.nodes.forEach((n) => maps.nodesMap.set(n.id, JSON.stringify(n)))
        merged.edges.forEach((e) => maps.edgesMap.set(e.id, JSON.stringify(e)))
      })
    },
    [maps, nodes, edges],
  )

  const deleteNode = useCallback(
    (nodeId: string, recursive: boolean) => {
      if (!maps) return
      const toRemove = new Set([nodeId])
      if (recursive) {
        getDescendantIds(nodeId, nodes).forEach((id) => toRemove.add(id))
      }
      maps.nodesMap.doc?.transact(() => {
        toRemove.forEach((id) => maps.nodesMap.delete(id))
        // Remove edges that reference any deleted node
        edges.forEach((edge) => {
          if (toRemove.has(edge.source) || toRemove.has(edge.target)) {
            maps.edgesMap.delete(edge.id)
          }
        })
        // Remove notes for deleted nodes
        notes.forEach((note) => {
          if (note.targetType === "node" && toRemove.has(note.targetId)) {
            maps.notesMap.delete(note.id)
          }
        })
      })
    },
    [maps, nodes, edges, notes],
  )

  const togglePinnedNode = useCallback(
    (nodeId: string) => {
      if (!maps) return
      if (maps.pinnedNodesMap.has(nodeId)) maps.pinnedNodesMap.delete(nodeId)
      else maps.pinnedNodesMap.set(nodeId, "1")
    },
    [maps],
  )

  const togglePinnedEdge = useCallback(
    (edgeId: string) => {
      if (!maps) return
      if (maps.pinnedEdgesMap.has(edgeId)) maps.pinnedEdgesMap.delete(edgeId)
      else maps.pinnedEdgesMap.set(edgeId, "1")
    },
    [maps],
  )

  const addNote = useCallback(
    (body: string, selectedNodeId: string | null, selectedEdgeId: string | null, userName: string) => {
      if (!maps) return
      const trimmed = body.trim()
      if (!trimmed) return
      const targetType = selectedNodeId ? "node" : selectedEdgeId ? "edge" : null
      const targetId = selectedNodeId ?? selectedEdgeId
      if (!targetType || !targetId) return

      const note: HuntGraphNote = {
        authorName: userName,
        body: trimmed,
        createdAt: Date.now(),
        id: crypto.randomUUID(),
        targetId,
        targetType,
      }
      maps.notesMap.set(note.id, JSON.stringify(note))
    },
    [maps],
  )

  const setFilters = useCallback(
    (nextFilters: HuntGraphFilters) => {
      maps?.filtersMap.set("filters", JSON.stringify(nextFilters))
    },
    [maps],
  )

  const setNodeKindEnabled = useCallback(
    (kind: HuntGraphNode["kind"], enabled: boolean) => {
      const current = filters.nodeKinds.length > 0 ? filters.nodeKinds : availableNodeKinds
      const next = enabled
        ? Array.from(new Set([...current, kind]))
        : current.filter((k) => k !== kind)
      setFilters({
        edgeKinds: filters.edgeKinds,
        nodeKinds: next.length === availableNodeKinds.length ? [] : next,
      })
    },
    [availableNodeKinds, filters, setFilters],
  )

  const setEdgeKindEnabled = useCallback(
    (kind: HuntGraphEdge["kind"], enabled: boolean) => {
      const current = filters.edgeKinds.length > 0 ? filters.edgeKinds : availableEdgeKinds
      const next = enabled
        ? Array.from(new Set([...current, kind]))
        : current.filter((k) => k !== kind)
      setFilters({
        edgeKinds: next.length === availableEdgeKinds.length ? [] : next,
        nodeKinds: filters.nodeKinds,
      })
    },
    [availableEdgeKinds, filters, setFilters],
  )

  return {
    addNote,
    availableEdgeKinds,
    availableNodeKinds,
    deleteNode,
    filteredEdges,
    filteredNodes,
    mergeGraphData,
    setEdgeKindEnabled,
    setFilters,
    setNodeKindEnabled,
    togglePinnedEdge,
    togglePinnedNode,
  }
}

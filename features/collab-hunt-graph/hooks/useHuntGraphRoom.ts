"use client"

import { getHuntGraphAdapter } from "@/features/collab-hunt-graph/lib/adapters"
import type {
  HuntGraphEdge,
  HuntGraphFilters,
  HuntGraphNode,
  HuntGraphNote,
  HuntGraphSnapshot,
  SavedHuntGraphViewDetail,
} from "@/features/collab-hunt-graph/lib/types"
import type { CaseAccessContext } from "@/lib/auth/permissions"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { WebsocketProvider } from "y-websocket"
import * as Y from "yjs"

type ConnectionStatus = "connected" | "connecting" | "disconnected"

const EMPTY_FILTERS: HuntGraphFilters = {
  edgeKinds: [],
  nodeKinds: [],
}

function parseNode(value: string | undefined): HuntGraphNode | null {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as HuntGraphNode
  } catch {
    return null
  }
}

function parseEdge(value: string | undefined): HuntGraphEdge | null {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as HuntGraphEdge
  } catch {
    return null
  }
}

function parseNote(value: string | undefined): HuntGraphNote | null {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as HuntGraphNote
  } catch {
    return null
  }
}

function parseFilters(value: string | undefined): HuntGraphFilters {
  if (!value) {
    return EMPTY_FILTERS
  }

  try {
    const parsed = JSON.parse(value) as Partial<HuntGraphFilters>

    return {
      edgeKinds: Array.isArray(parsed.edgeKinds) ? parsed.edgeKinds : [],
      nodeKinds: Array.isArray(parsed.nodeKinds) ? parsed.nodeKinds : [],
    }
  } catch {
    return EMPTY_FILTERS
  }
}

function serializeFilters(filters: HuntGraphFilters) {
  return JSON.stringify(filters)
}

function uniqueValues<T>(values: T[]) {
  return Array.from(new Set(values))
}

function mergeNodes(currentNodes: HuntGraphNode[], nextNodes: HuntGraphNode[]) {
  return Array.from(
    new Map([...currentNodes, ...nextNodes].map((node) => [node.id, node])).values(),
  )
}

function mergeEdges(currentEdges: HuntGraphEdge[], nextEdges: HuntGraphEdge[]) {
  return Array.from(
    new Map([...currentEdges, ...nextEdges].map((edge) => [edge.id, edge])).values(),
  )
}

function getCollabServerUrl() {
  if (typeof window === "undefined") {
    return "ws://localhost:1234"
  }

  const configured = process.env.NEXT_PUBLIC_Y_WEBSOCKET_URL?.trim()

  if (configured) {
    return configured.replace("localhost", window.location.hostname)
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"

  return `${protocol}//${window.location.hostname}:1234`
}

function readMapValues<T>(
  sourceMap: Y.Map<string>,
  parser: (value: string | undefined) => T | null,
) {
  return Array.from(sourceMap.values())
    .map((value) => parser(value))
    .filter((value): value is T => value !== null)
}

export function useHuntGraphRoom(
  roomId: string,
  initialView: SavedHuntGraphViewDetail | null,
  currentUser: Pick<CaseAccessContext, "name">,
) {
  const nodesMapRef = useRef<Y.Map<string> | null>(null)
  const edgesMapRef = useRef<Y.Map<string> | null>(null)
  const notesMapRef = useRef<Y.Map<string> | null>(null)
  const pinnedNodesMapRef = useRef<Y.Map<string> | null>(null)
  const pinnedEdgesMapRef = useRef<Y.Map<string> | null>(null)
  const metaMapRef = useRef<Y.Map<string> | null>(null)
  const filtersMapRef = useRef<Y.Map<string> | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const selectedNodeIdRef = useRef<string | null>(null)

  const [userName] = useState(currentUser.name)
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting")
  const [collabToken, setCollabToken] = useState<string | null>(null)
  const [nodes, setNodes] = useState<HuntGraphNode[]>([])
  const [edges, setEdges] = useState<HuntGraphEdge[]>([])
  const [notes, setNotes] = useState<HuntGraphNote[]>([])
  const [pinnedNodeIds, setPinnedNodeIds] = useState<string[]>([])
  const [pinnedEdgeIds, setPinnedEdgeIds] = useState<string[]>([])
  const [filters, setFiltersState] = useState<HuntGraphFilters>(EMPTY_FILTERS)
  const [adapterId, setAdapterId] = useState<string | null>(
    initialView?.snapshot.adapterId ?? "mocked-sigma",
  )
  const [query, setQuery] = useState(initialView?.snapshot.query ?? "")
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(
    initialView?.id ?? null,
  )
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState(
    "Load a datasource result to start the shared hunt graph.",
  )

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId
  }, [selectedNodeId])

  useEffect(() => {
    let cancelled = false

    void fetch(`/api/rooms/${roomId}/access`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          collabToken?: string
          error?: string
        }

        if (!response.ok || !payload.collabToken) {
          throw new Error(payload.error || "Unable to join this room.")
        }

        if (!cancelled) {
          setCollabToken(payload.collabToken)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConnectionStatus("disconnected")
        }
      })

    return () => {
      cancelled = true
    }
  }, [roomId])

  const applySnapshot = useCallback((snapshot: HuntGraphSnapshot) => {
    const nodesMap = nodesMapRef.current
    const edgesMap = edgesMapRef.current
    const notesMap = notesMapRef.current
    const pinnedNodesMap = pinnedNodesMapRef.current
    const pinnedEdgesMap = pinnedEdgesMapRef.current
    const metaMap = metaMapRef.current
    const filtersMap = filtersMapRef.current

    if (
      !nodesMap ||
      !edgesMap ||
      !notesMap ||
      !pinnedNodesMap ||
      !pinnedEdgesMap ||
      !metaMap ||
      !filtersMap
    ) {
      return
    }

    const doc = nodesMap.doc

    doc?.transact(() => {
      nodesMap.clear()
      edgesMap.clear()
      notesMap.clear()
      pinnedNodesMap.clear()
      pinnedEdgesMap.clear()

      snapshot.nodes.forEach((node) => {
        nodesMap.set(node.id, JSON.stringify(node))
      })
      snapshot.edges.forEach((edge) => {
        edgesMap.set(edge.id, JSON.stringify(edge))
      })
      snapshot.notes.forEach((note) => {
        notesMap.set(note.id, JSON.stringify(note))
      })
      snapshot.pinnedNodeIds.forEach((nodeId) => {
        pinnedNodesMap.set(nodeId, "1")
      })
      snapshot.pinnedEdgeIds.forEach((edgeId) => {
        pinnedEdgesMap.set(edgeId, "1")
      })

      metaMap.set("adapterId", snapshot.adapterId ?? "")
      metaMap.set("query", snapshot.query)
      metaMap.set("activeSavedViewId", snapshot.activeSavedViewId ?? "")
      metaMap.set("seedVersion", "1")
      filtersMap.set("filters", serializeFilters(snapshot.filters))
    })
  }, [])

  useEffect(() => {
    if (!collabToken) {
      return
    }

    const doc = new Y.Doc()
    const provider = new WebsocketProvider(
      getCollabServerUrl(),
      `hunt:${roomId}`,
      doc,
      {
        params: {
          token: collabToken,
        },
      },
    )
    const nodesMap = doc.getMap<string>("nodes")
    const edgesMap = doc.getMap<string>("edges")
    const notesMap = doc.getMap<string>("notes")
    const pinnedNodesMap = doc.getMap<string>("pinned-nodes")
    const pinnedEdgesMap = doc.getMap<string>("pinned-edges")
    const metaMap = doc.getMap<string>("meta")
    const filtersMap = doc.getMap<string>("filters")

    nodesMapRef.current = nodesMap
    edgesMapRef.current = edgesMap
    notesMapRef.current = notesMap
    pinnedNodesMapRef.current = pinnedNodesMap
    pinnedEdgesMapRef.current = pinnedEdgesMap
    metaMapRef.current = metaMap
    filtersMapRef.current = filtersMap
    providerRef.current = provider

    const syncAll = () => {
      setNodes(readMapValues(nodesMap, parseNode))
      setEdges(readMapValues(edgesMap, parseEdge))
      setNotes(readMapValues(notesMap, parseNote).sort((left, right) => right.createdAt - left.createdAt))
      setPinnedNodeIds(Array.from(pinnedNodesMap.keys()))
      setPinnedEdgeIds(Array.from(pinnedEdgesMap.keys()))
      setFiltersState(parseFilters(filtersMap.get("filters")))
      setAdapterId(metaMap.get("adapterId") || "mocked-sigma")
      setQuery(metaMap.get("query") || "")
      setActiveSavedViewId(metaMap.get("activeSavedViewId") || null)
    }

    const handleStatus = ({ status }: { status: ConnectionStatus }) => {
      setConnectionStatus(status)
    }

    const handleSync = (isSynced: boolean) => {
      if (!isSynced) {
        return
      }

      if (initialView && metaMap.get("activeSavedViewId") !== initialView.id) {
        applySnapshot(initialView.snapshot)
      } else if (metaMap.get("seedVersion") !== "1") {
        metaMap.set("seedVersion", "1")
        metaMap.set("adapterId", initialView?.snapshot.adapterId ?? "mocked-sigma")
        metaMap.set("query", initialView?.snapshot.query ?? "")
        metaMap.set("activeSavedViewId", initialView?.id ?? "")
        filtersMap.set(
          "filters",
          serializeFilters(initialView?.snapshot.filters ?? EMPTY_FILTERS),
        )
      }

      syncAll()
    }

    provider.on("status", handleStatus)
    provider.on("sync", handleSync)

    nodesMap.observe(syncAll)
    edgesMap.observe(syncAll)
    notesMap.observe(syncAll)
    pinnedNodesMap.observe(syncAll)
    pinnedEdgesMap.observe(syncAll)
    metaMap.observe(syncAll)
    filtersMap.observe(syncAll)
    syncAll()

    return () => {
      nodesMap.unobserve(syncAll)
      edgesMap.unobserve(syncAll)
      notesMap.unobserve(syncAll)
      pinnedNodesMap.unobserve(syncAll)
      pinnedEdgesMap.unobserve(syncAll)
      metaMap.unobserve(syncAll)
      filtersMap.unobserve(syncAll)
      provider.off("status", handleStatus)
      provider.off("sync", handleSync)
      provider.destroy()
      doc.destroy()
      nodesMapRef.current = null
      edgesMapRef.current = null
      notesMapRef.current = null
      pinnedNodesMapRef.current = null
      pinnedEdgesMapRef.current = null
      metaMapRef.current = null
      filtersMapRef.current = null
      providerRef.current = null
    }
  }, [applySnapshot, collabToken, initialView, roomId])

  const availableNodeKinds = useMemo(
    () => uniqueValues(nodes.map((node) => node.kind)).sort(),
    [nodes],
  )
  const availableEdgeKinds = useMemo(
    () => uniqueValues(edges.map((edge) => edge.kind)).sort(),
    [edges],
  )

  const visibleNodeKinds =
    filters.nodeKinds.length > 0 ? filters.nodeKinds : availableNodeKinds
  const visibleEdgeKinds =
    filters.edgeKinds.length > 0 ? filters.edgeKinds : availableEdgeKinds

  const filteredNodes = useMemo(
    () => nodes.filter((node) => visibleNodeKinds.includes(node.kind)),
    [nodes, visibleNodeKinds],
  )

  const filteredNodeIdSet = useMemo(
    () => new Set(filteredNodes.map((node) => node.id)),
    [filteredNodes],
  )

  const filteredEdges = useMemo(
    () =>
      edges.filter(
        (edge) =>
          visibleEdgeKinds.includes(edge.kind) &&
          filteredNodeIdSet.has(edge.source) &&
          filteredNodeIdSet.has(edge.target),
      ),
    [edges, filteredNodeIdSet, visibleEdgeKinds],
  )

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )
  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  )

  const selectedNotes = useMemo(() => {
    if (selectedNodeId) {
      return notes.filter(
        (note) => note.targetType === "node" && note.targetId === selectedNodeId,
      )
    }

    if (selectedEdgeId) {
      return notes.filter(
        (note) => note.targetType === "edge" && note.targetId === selectedEdgeId,
      )
    }

    return []
  }, [notes, selectedEdgeId, selectedNodeId])

  const updateFilters = useCallback((nextFilters: HuntGraphFilters) => {
    setFiltersState(nextFilters)
    filtersMapRef.current?.set("filters", serializeFilters(nextFilters))
  }, [])

  const setNodeKindEnabled = useCallback(
    (kind: HuntGraphNode["kind"], enabled: boolean) => {
      const nextKinds = enabled
        ? uniqueValues([...visibleNodeKinds, kind])
        : visibleNodeKinds.filter((item) => item !== kind)

      updateFilters({
        edgeKinds: filters.edgeKinds,
        nodeKinds: nextKinds.length === availableNodeKinds.length ? [] : nextKinds,
      })
    },
    [availableNodeKinds.length, filters.edgeKinds, updateFilters, visibleNodeKinds],
  )

  const setEdgeKindEnabled = useCallback(
    (kind: HuntGraphEdge["kind"], enabled: boolean) => {
      const nextKinds = enabled
        ? uniqueValues([...visibleEdgeKinds, kind])
        : visibleEdgeKinds.filter((item) => item !== kind)

      updateFilters({
        edgeKinds: nextKinds.length === availableEdgeKinds.length ? [] : nextKinds,
        nodeKinds: filters.nodeKinds,
      })
    },
    [availableEdgeKinds.length, filters.nodeKinds, updateFilters, visibleEdgeKinds],
  )

  const setAdapterAndQuery = useCallback((nextAdapterId: string, nextQuery: string) => {
    metaMapRef.current?.set("adapterId", nextAdapterId)
    metaMapRef.current?.set("query", nextQuery)
    setAdapterId(nextAdapterId)
    setQuery(nextQuery)
  }, [])

  const loadGraphFromAdapter = useCallback(async () => {
    const adapter = getHuntGraphAdapter(adapterId)

    if (!adapter) {
      setStatusMessage("Select a datasource adapter before loading graph data.")
      return
    }

    const result = await adapter.buildInitialGraph({
      query,
      roomId,
    })

    applySnapshot({
      activeSavedViewId: null,
      adapterId: result.adapterId,
      edges: result.edges,
      filters: EMPTY_FILTERS,
      nodes: result.nodes,
      notes: [],
      pinnedEdgeIds: [],
      pinnedNodeIds: [],
      query,
    })
    setStatusMessage(result.summary)
    setSelectedEdgeId(null)
    setSelectedNodeId(null)
  }, [adapterId, applySnapshot, query, roomId])

  const expandSelectedNode = useCallback(async () => {
    const adapter = getHuntGraphAdapter(adapterId)
    const selectedNodeValue = nodes.find((node) => node.id === selectedNodeIdRef.current)

    if (!adapter?.expandFromNode || !selectedNodeValue) {
      setStatusMessage("Select a node that supports expansion.")
      return
    }

    const result = await adapter.expandFromNode({
      currentEdges: edges,
      currentNodes: nodes,
      node: selectedNodeValue,
      query,
      roomId,
    })

    applySnapshot({
      activeSavedViewId,
      adapterId: result.adapterId,
      edges: mergeEdges(edges, result.edges),
      filters,
      nodes: mergeNodes(nodes, result.nodes),
      notes,
      pinnedEdgeIds,
      pinnedNodeIds,
      query,
    })
    setStatusMessage(result.summary)
  }, [
    activeSavedViewId,
    adapterId,
    applySnapshot,
    edges,
    filters,
    nodes,
    notes,
    pinnedEdgeIds,
    pinnedNodeIds,
    query,
    roomId,
  ])

  const togglePinnedNode = useCallback((nodeId: string) => {
    const pinnedNodesMap = pinnedNodesMapRef.current

    if (!pinnedNodesMap) {
      return
    }

    if (pinnedNodesMap.has(nodeId)) {
      pinnedNodesMap.delete(nodeId)
      return
    }

    pinnedNodesMap.set(nodeId, "1")
  }, [])

  const togglePinnedEdge = useCallback((edgeId: string) => {
    const pinnedEdgesMap = pinnedEdgesMapRef.current

    if (!pinnedEdgesMap) {
      return
    }

    if (pinnedEdgesMap.has(edgeId)) {
      pinnedEdgesMap.delete(edgeId)
      return
    }

    pinnedEdgesMap.set(edgeId, "1")
  }, [])

  const addNote = useCallback(
    (body: string) => {
      const notesMap = notesMapRef.current
      const trimmedBody = body.trim()

      if (!notesMap || !trimmedBody) {
        return
      }

      const targetType = selectedNodeId ? "node" : selectedEdgeId ? "edge" : null
      const targetId = selectedNodeId || selectedEdgeId

      if (!targetType || !targetId) {
        return
      }

      const note: HuntGraphNote = {
        authorName: userName,
        body: trimmedBody,
        createdAt: Date.now(),
        id: crypto.randomUUID(),
        targetId,
        targetType,
      }

      notesMap.set(note.id, JSON.stringify(note))
    },
    [selectedEdgeId, selectedNodeId, userName],
  )

  const snapshot = useMemo(
    (): HuntGraphSnapshot => ({
      activeSavedViewId,
      adapterId,
      edges,
      filters,
      nodes,
      notes,
      pinnedEdgeIds,
      pinnedNodeIds,
      query,
    }),
    [
      activeSavedViewId,
      adapterId,
      edges,
      filters,
      nodes,
      notes,
      pinnedEdgeIds,
      pinnedNodeIds,
      query,
    ],
  )

  const loadSavedView = useCallback(
    (view: SavedHuntGraphViewDetail) => {
      applySnapshot(view.snapshot)
      setStatusMessage(`Loaded saved view "${view.title}".`)
      setSelectedEdgeId(null)
      setSelectedNodeId(null)
    },
    [applySnapshot],
  )

  return {
    activeSavedViewId,
    adapterId,
    availableEdgeKinds,
    availableNodeKinds,
    connectionStatus,
    expandSelectedNode,
    filteredEdges,
    filteredNodes,
    loadGraphFromAdapter,
    loadSavedView,
    notes,
    pinnedEdgeIds,
    pinnedNodeIds,
    query,
    selectedEdge,
    selectedEdgeId,
    selectedNode,
    selectedNodeId,
    selectedNotes,
    setAdapterAndQuery,
    setEdgeKindEnabled,
    setSelectedEdgeId,
    setSelectedNodeId,
    setNodeKindEnabled,
    snapshot,
    statusMessage,
    togglePinnedEdge,
    togglePinnedNode,
    updateFilters,
    userName,
    addNote,
  }
}

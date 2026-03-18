"use client"

import type {
  HuntGraphEdge,
  HuntGraphFilters,
  HuntGraphNode,
  HuntGraphNote,
  HuntGraphSnapshot,
  SavedHuntGraphViewDetail,
} from "@/features/collab-hunt-graph/lib/types"
import { apiRequest } from "@/lib/api/client"
import { useCallback, useEffect, useRef, useState } from "react"
import { WebsocketProvider } from "y-websocket"
import * as Y from "yjs"

export type YjsConnectionStatus = "connected" | "connecting" | "disconnected"

type CollabTokenResponse = { collabToken?: string; error?: string }

const EMPTY_FILTERS: HuntGraphFilters = { edgeKinds: [], nodeKinds: [] }

function safeParse<T>(value: string | undefined): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function parseFilters(value: string | undefined): HuntGraphFilters {
  if (!value) return EMPTY_FILTERS
  const parsed = safeParse<Partial<HuntGraphFilters>>(value)
  return {
    edgeKinds: Array.isArray(parsed?.edgeKinds) ? parsed!.edgeKinds : [],
    nodeKinds: Array.isArray(parsed?.nodeKinds) ? parsed!.nodeKinds : [],
  }
}

function readMapValues<T>(map: Y.Map<string>, parse: (v: string) => T | null): T[] {
  return Array.from(map.values())
    .map(parse)
    .filter((v): v is T => v !== null)
}

function getCollabServerUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:1234"
  const configured = process.env.NEXT_PUBLIC_Y_WEBSOCKET_URL?.trim()
  if (configured) return configured.replace("localhost", window.location.hostname)
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${window.location.hostname}:1234`
}

export type HuntGraphYjsMaps = {
  nodesMap: Y.Map<string>
  edgesMap: Y.Map<string>
  notesMap: Y.Map<string>
  pinnedNodesMap: Y.Map<string>
  pinnedEdgesMap: Y.Map<string>
  metaMap: Y.Map<string>
  filtersMap: Y.Map<string>
}

export type UseHuntGraphYjsReturn = {
  connectionStatus: YjsConnectionStatus
  isReady: boolean
  maps: HuntGraphYjsMaps | null
  applySnapshot: (snapshot: HuntGraphSnapshot) => void
  nodes: HuntGraphNode[]
  edges: HuntGraphEdge[]
  notes: HuntGraphNote[]
  pinnedNodeIds: string[]
  pinnedEdgeIds: string[]
  filters: HuntGraphFilters
  adapterId: string | null
  datasourceId: string | null
  query: string
  activeSavedViewId: string | null
  timeField: string | null
  columnMapping: HuntGraphSnapshot["columnMapping"]
}

export function useHuntGraphYjs(
  roomId: string,
  initialView: SavedHuntGraphViewDetail | null,
): UseHuntGraphYjsReturn {
  const mapsRef = useRef<HuntGraphYjsMaps | null>(null)

  const [connectionStatus, setConnectionStatus] = useState<YjsConnectionStatus>("connecting")
  const [isReady, setIsReady] = useState(false)
  const [collabToken, setCollabToken] = useState<string | null>(null)
  const [nodes, setNodes] = useState<HuntGraphNode[]>([])
  const [edges, setEdges] = useState<HuntGraphEdge[]>([])
  const [notes, setNotes] = useState<HuntGraphNote[]>([])
  const [pinnedNodeIds, setPinnedNodeIds] = useState<string[]>([])
  const [pinnedEdgeIds, setPinnedEdgeIds] = useState<string[]>([])
  const [filters, setFilters] = useState<HuntGraphFilters>(EMPTY_FILTERS)
  const [adapterId, setAdapterId] = useState<string | null>(
    initialView?.snapshot.adapterId ?? null,
  )
  const [datasourceId, setDatasourceId] = useState<string | null>(
    initialView?.snapshot.datasourceId ?? null,
  )
  const [query, setQuery] = useState(initialView?.snapshot.query ?? "")
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(
    initialView?.id ?? null,
  )
  const [timeField, setTimeField] = useState<string | null>(
    initialView?.snapshot.timeField ?? null,
  )
  const [columnMapping, setColumnMapping] = useState<HuntGraphSnapshot["columnMapping"]>(
    initialView?.snapshot.columnMapping ?? null,
  )

  // Fetch collab token via apiRequest (no raw fetch)
  useEffect(() => {
    let cancelled = false
    apiRequest<CollabTokenResponse>(`/api/rooms/${roomId}/access`, { cache: "no-store" })
      .then((payload) => {
        if (!cancelled && payload.collabToken) setCollabToken(payload.collabToken)
        else if (!cancelled) setConnectionStatus("disconnected")
      })
      .catch(() => { if (!cancelled) setConnectionStatus("disconnected") })
    return () => { cancelled = true }
  }, [roomId])

  const applySnapshot = useCallback((snapshot: HuntGraphSnapshot) => {
    const maps = mapsRef.current
    if (!maps) return

    maps.nodesMap.doc?.transact(() => {
      maps.nodesMap.clear()
      maps.edgesMap.clear()
      maps.notesMap.clear()
      maps.pinnedNodesMap.clear()
      maps.pinnedEdgesMap.clear()

      snapshot.nodes.forEach((n) => maps.nodesMap.set(n.id, JSON.stringify(n)))
      snapshot.edges.forEach((e) => maps.edgesMap.set(e.id, JSON.stringify(e)))
      snapshot.notes.forEach((n) => maps.notesMap.set(n.id, JSON.stringify(n)))
      snapshot.pinnedNodeIds.forEach((id) => maps.pinnedNodesMap.set(id, "1"))
      snapshot.pinnedEdgeIds.forEach((id) => maps.pinnedEdgesMap.set(id, "1"))

      maps.metaMap.set("adapterId", snapshot.adapterId ?? "")
      maps.metaMap.set("datasourceId", snapshot.datasourceId ?? "")
      maps.metaMap.set("query", snapshot.query)
      maps.metaMap.set("activeSavedViewId", snapshot.activeSavedViewId ?? "")
      maps.metaMap.set("timeField", snapshot.timeField ?? "")
      maps.metaMap.set("columnMapping", snapshot.columnMapping ? JSON.stringify(snapshot.columnMapping) : "")
      maps.metaMap.set("seedVersion", "1")
      maps.filtersMap.set("filters", JSON.stringify(snapshot.filters))
    })
  }, [])

  useEffect(() => {
    if (!collabToken) return

    const doc = new Y.Doc()
    const provider = new WebsocketProvider(getCollabServerUrl(), `hunt:${roomId}`, doc, {
      params: { token: collabToken },
    })

    const maps: HuntGraphYjsMaps = {
      nodesMap: doc.getMap<string>("nodes"),
      edgesMap: doc.getMap<string>("edges"),
      notesMap: doc.getMap<string>("notes"),
      pinnedNodesMap: doc.getMap<string>("pinned-nodes"),
      pinnedEdgesMap: doc.getMap<string>("pinned-edges"),
      metaMap: doc.getMap<string>("meta"),
      filtersMap: doc.getMap<string>("filters"),
    }
    mapsRef.current = maps

    const syncAll = () => {
      setNodes(readMapValues(maps.nodesMap, (v) => safeParse<HuntGraphNode>(v)))
      setEdges(readMapValues(maps.edgesMap, (v) => safeParse<HuntGraphEdge>(v)))
      setNotes(
        readMapValues(maps.notesMap, (v) => safeParse<HuntGraphNote>(v))
          .sort((a, b) => b.createdAt - a.createdAt),
      )
      setPinnedNodeIds(Array.from(maps.pinnedNodesMap.keys()))
      setPinnedEdgeIds(Array.from(maps.pinnedEdgesMap.keys()))
      setFilters(parseFilters(maps.filtersMap.get("filters")))
      setAdapterId(maps.metaMap.get("adapterId") || null)
      setDatasourceId(maps.metaMap.get("datasourceId") || null)
      setQuery(maps.metaMap.get("query") || "")
      setActiveSavedViewId(maps.metaMap.get("activeSavedViewId") || null)
      setTimeField(maps.metaMap.get("timeField") || null)
      const cmRaw = maps.metaMap.get("columnMapping")
      setColumnMapping(cmRaw ? safeParse<HuntGraphSnapshot["columnMapping"]>(cmRaw) : null)
    }

    const handleStatus = ({ status }: { status: YjsConnectionStatus }) => {
      setConnectionStatus(status)
    }

    const handleSync = (isSynced: boolean) => {
      if (!isSynced) return
      if (initialView && maps.metaMap.get("activeSavedViewId") !== initialView.id) {
        applySnapshot(initialView.snapshot)
      } else if (maps.metaMap.get("seedVersion") !== "1") {
        maps.metaMap.set("seedVersion", "1")
      }
      syncAll()
      setIsReady(true)
    }

    provider.on("status", handleStatus)
    provider.on("sync", handleSync)
    Object.values(maps).forEach((m) => m.observe(syncAll))
    syncAll()

    return () => {
      Object.values(maps).forEach((m) => m.unobserve(syncAll))
      provider.off("status", handleStatus)
      provider.off("sync", handleSync)
      provider.destroy()
      doc.destroy()
      mapsRef.current = null
    }
  }, [applySnapshot, collabToken, initialView, roomId])

  return {
    activeSavedViewId,
    adapterId,
    applySnapshot,
    columnMapping,
    connectionStatus,
    datasourceId,
    edges,
    filters,
    isReady,
    maps: mapsRef.current,
    nodes,
    notes,
    pinnedEdgeIds,
    pinnedNodeIds,
    query,
    timeField,
  }
}

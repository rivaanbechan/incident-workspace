import type { EntityKind } from "@/lib/contracts/entities"

export type HuntNodeKind = EntityKind | "alert-group" | "detection" | "session"

export type HuntEdgeKind =
  | "authenticates-to"
  | "communicates-with"
  | "observed-on"
  | "related-to"
  | "source-to-destination"
  | "triggered-alert"

export type HuntGraphNode = {
  color: string
  id: string
  kind: HuntNodeKind
  label: string
  size: number
  summary?: string
  x?: number
  y?: number
}

export type HuntGraphEdge = {
  color: string
  id: string
  kind: HuntEdgeKind
  label: string
  source: string
  summary?: string
  target: string
  weight: number
}

export type HuntGraphNote = {
  authorName: string
  body: string
  createdAt: number
  id: string
  targetId: string
  targetType: "edge" | "node"
}

export type HuntGraphFilters = {
  edgeKinds: HuntEdgeKind[]
  nodeKinds: HuntNodeKind[]
}

export type HuntGraphSnapshot = {
  activeSavedViewId: string | null
  adapterId: string | null
  edges: HuntGraphEdge[]
  filters: HuntGraphFilters
  nodes: HuntGraphNode[]
  notes: HuntGraphNote[]
  pinnedEdgeIds: string[]
  pinnedNodeIds: string[]
  query: string
}

export type SavedHuntGraphViewRecord = {
  adapterId: string | null
  createdAt: string
  edgeCount: number
  id: string
  nodeCount: number
  query: string
  roomId: string
  title: string
  updatedAt: string
}

export type SavedHuntGraphViewDetail = SavedHuntGraphViewRecord & {
  snapshot: HuntGraphSnapshot
}

export type HuntGraphAdapterQuery = {
  query: string
  roomId: string
}

export type HuntGraphAdapterExpansion = {
  currentEdges: HuntGraphEdge[]
  currentNodes: HuntGraphNode[]
  node: HuntGraphNode
  query: string
  roomId: string
}

export type HuntGraphAdapterResult = {
  adapterId: string
  edges: HuntGraphEdge[]
  nodes: HuntGraphNode[]
  summary: string
}

export type HuntGraphAdapter = {
  buildInitialGraph: (
    input: HuntGraphAdapterQuery,
  ) => Promise<HuntGraphAdapterResult> | HuntGraphAdapterResult
  description: string
  expandFromNode?: (
    input: HuntGraphAdapterExpansion,
  ) => Promise<HuntGraphAdapterResult> | HuntGraphAdapterResult
  id: string
  title: string
}


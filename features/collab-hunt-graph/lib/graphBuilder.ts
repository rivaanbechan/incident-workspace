import type {
  ColumnMapping,
  HuntEdgeKind,
  HuntGraphEdge,
  HuntGraphNode,
  HuntNodeKind,
  HuntNodeOrigin,
} from "@/features/collab-hunt-graph/lib/types"
import type { DatasourceSearchRow } from "@/lib/datasources/types"

// Deterministic color from a string value — used for auto-coloring raw nodes
function hashString(value: string): number {
  return Array.from(value).reduce((acc, char, idx) => acc + char.charCodeAt(0) * (idx + 7), 0)
}

const AUTO_COLORS = [
  "#2563eb", "#0ea5e9", "#0f766e", "#7c3aed", "#dc2626",
  "#f59e0b", "#9333ea", "#c026d3", "#0891b2", "#334155",
]

export function colorForValue(value: string): string {
  return AUTO_COLORS[hashString(value) % AUTO_COLORS.length]
}

function buildNodeId(value: string): string {
  return value.trim().toLowerCase()
}

function buildEdgeId(source: string, target: string): string {
  return `${source}-->${target}`
}

function getStringValue(raw: Record<string, unknown>, column: string): string | null {
  const value = raw[column]
  if (value === null || value === undefined || value === "") return null
  return String(value).trim()
}

export type BuildGraphInput = {
  columnMapping: ColumnMapping
  origin: HuntNodeOrigin
  parentId: string | null
  depth: number
  rows: DatasourceSearchRow[]
  timeField: string | null
}

export type BuildGraphResult = {
  nodes: HuntGraphNode[]
  edges: HuntGraphEdge[]
}

export function buildNodesAndEdgesFromRows(input: BuildGraphInput): BuildGraphResult {
  const { columnMapping, origin, parentId, depth, rows, timeField } = input
  const nodeMap = new Map<string, HuntGraphNode>()
  const edgeWeightMap = new Map<string, number>()
  const edgeMap = new Map<string, HuntGraphEdge>()

  for (const row of rows) {
    const srcValue = getStringValue(row.raw, columnMapping.sourceColumn)
    const dstValue = getStringValue(row.raw, columnMapping.destColumn)
    if (!srcValue || !dstValue) continue

    const srcId = buildNodeId(srcValue)
    const dstId = buildNodeId(dstValue)
    const edgeId = buildEdgeId(srcId, dstId)
    const discoveredAt = timeField ? parseTimestamp(row.raw[timeField]) : null

    const labelColumn = columnMapping.labelColumn
    const srcLabel = labelColumn ? getStringValue(row.raw, labelColumn) ?? srcValue : srcValue
    const dstLabel = labelColumn ? getStringValue(row.raw, labelColumn) ?? dstValue : dstValue

    if (!nodeMap.has(srcId)) {
      nodeMap.set(srcId, buildNode(srcId, srcLabel, origin, parentId, depth, discoveredAt))
    }
    if (!nodeMap.has(dstId)) {
      nodeMap.set(dstId, buildNode(dstId, dstLabel, origin, srcId, depth + 1, discoveredAt))
    }

    // Merge multi-edges by accumulating weight
    const currentWeight = edgeWeightMap.get(edgeId) ?? 0
    edgeWeightMap.set(edgeId, currentWeight + 1)

    if (!edgeMap.has(edgeId)) {
      edgeMap.set(edgeId, {
        color: colorForValue(srcId),
        discoveredAt,
        id: edgeId,
        kind: "source-to-destination" as HuntEdgeKind,
        label: `${srcValue} → ${dstValue}`,
        source: srcId,
        target: dstId,
        weight: 1,
      })
    }
  }

  // Apply accumulated weights to edges
  const edges: HuntGraphEdge[] = Array.from(edgeMap.values()).map((edge) => ({
    ...edge,
    weight: Math.min(edgeWeightMap.get(edge.id) ?? 1, 8),
  }))

  return { edges, nodes: Array.from(nodeMap.values()) }
}

function parseTimestamp(value: unknown): number | null {
  if (!value) return null
  const parsed = typeof value === "number" ? value : Date.parse(String(value))
  return isNaN(parsed) ? null : parsed
}

function buildNode(
  id: string,
  label: string,
  origin: HuntNodeOrigin,
  parentId: string | null,
  depth: number,
  discoveredAt: number | null,
): HuntGraphNode {
  const kind: HuntNodeKind = "host"
  return {
    color: colorForValue(id),
    depth,
    discoveredAt,
    id,
    kind,
    label,
    origin,
    parentId,
    size: depth === 0 ? 15 : 12,
    x: Math.cos(hashString(id)) * 10,
    y: Math.sin(hashString(id)) * 10,
  }
}

export function deduplicateNodes(
  existing: HuntGraphNode[],
  incoming: HuntGraphNode[],
): HuntGraphNode[] {
  return Array.from(
    new Map([...existing, ...incoming].map((n) => [n.id, n])).values(),
  )
}

export function deduplicateEdges(
  existing: HuntGraphEdge[],
  incoming: HuntGraphEdge[],
): HuntGraphEdge[] {
  return Array.from(
    new Map([...existing, ...incoming].map((e) => [e.id, e])).values(),
  )
}

// Returns all descendant node IDs (children, grandchildren, …) of a given node
export function getDescendantIds(nodeId: string, nodes: HuntGraphNode[]): Set<string> {
  const result = new Set<string>()
  const queue = [nodeId]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const node of nodes) {
      if (node.parentId === current && !result.has(node.id)) {
        result.add(node.id)
        queue.push(node.id)
      }
    }
  }

  return result
}

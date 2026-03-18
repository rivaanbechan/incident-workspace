import type {
  HuntGraphAdapter,
  HuntGraphAdapterExpansion,
  HuntGraphAdapterQuery,
  HuntGraphEdge,
  HuntGraphNode,
  HuntEdgeKind,
  HuntNodeKind,
} from "@/features/collab-hunt-graph/lib/types"

const nodePalette: Record<HuntNodeKind, string> = {
  account: "#2563eb",
  alert: "#dc2626",
  "alert-group": "#b91c1c",
  "cloud-resource": "#0f766e",
  detection: "#f59e0b",
  domain: "#7c3aed",
  file: "#475569",
  hash: "#78716c",
  host: "#0f766e",
  identity: "#1d4ed8",
  ip: "#0ea5e9",
  process: "#334155",
  registry: "#b45309",
  service: "#9333ea",
  session: "#0284c7",
  url: "#c026d3",
  user: "#2563eb",
}

const edgePalette: Record<HuntEdgeKind, string> = {
  "authenticates-to": "#2563eb",
  "communicates-with": "#0ea5e9",
  "observed-on": "#64748b",
  "related-to": "#94a3b8",
  "source-to-destination": "#0891b2",
  "triggered-alert": "#dc2626",
}

function hashInput(value: string) {
  return Array.from(value).reduce((total, character, index) => {
    return total + character.charCodeAt(0) * (index + 7)
  }, 0)
}

function getSeededPosition(id: string, index: number, total: number) {
  const hash = hashInput(`${id}:${index}:${total}`)
  const angle = ((hash % 360) * Math.PI) / 180
  const radius = 6 + (hash % 10)
  return {
    x: Math.cos(angle) * radius + (index - total / 2) * 1.3,
    y: Math.sin(angle) * radius + ((hash % 5) - 2) * 1.8,
  }
}

function createNode(
  id: string,
  label: string,
  kind: HuntNodeKind,
  index: number,
  total: number,
  summary?: string,
): HuntGraphNode {
  const position = getSeededPosition(id, index, total)
  return {
    color: nodePalette[kind],
    depth: 0,
    discoveredAt: null,
    id,
    kind,
    label,
    origin: "original",
    parentId: null,
    size:
      kind === "alert-group" || kind === "detection" ? 17
      : kind === "host" || kind === "user" ? 15
      : 12,
    summary,
    x: position.x,
    y: position.y,
  }
}

function createEdge(
  id: string,
  source: string,
  target: string,
  kind: HuntEdgeKind,
  label: string,
  weight = 1,
  summary?: string,
): HuntGraphEdge {
  return {
    color: edgePalette[kind],
    discoveredAt: null,
    id,
    kind,
    label,
    source,
    summary,
    target,
    weight,
  }
}

function dedupeNodes(nodes: HuntGraphNode[]) {
  return Array.from(new Map(nodes.map((n) => [n.id, n])).values())
}

function dedupeEdges(edges: HuntGraphEdge[]) {
  return Array.from(new Map(edges.map((e) => [e.id, e])).values())
}

function buildMockGraph(query: string) {
  const q = query.trim() || "suspicious lateral movement"
  const h = hashInput(q)
  const focusHost = `host-${h % 7}`
  const focusUser = `user-${h % 5}`
  const destHost = `target-${(h + 3) % 9}`
  const alertId = `alert-${h % 11}`
  const detectionId = `sigma-${h % 13}`
  const ipId = `ip-${h % 17}`
  const sessionId = `session-${h % 19}`

  const nodeSpecs: Array<[string, string, HuntNodeKind, string]> = [
    [focusUser, `svc-${(h % 4) + 1}-ops`, "user", `Identity referenced by "${q}".`],
    [focusHost, `win-prod-${(h % 6) + 11}`, "host", "Primary source host."],
    [destHost, `db-core-${(h % 5) + 3}`, "host", "Destination host."],
    [ipId, `10.24.${h % 20}.${(h % 200) + 10}`, "ip", "Network origin."],
    [alertId, `Alert Group ${h % 50}`, "alert-group", "Alert cluster."],
    [detectionId, `Sigma Match ${h % 80}`, "detection", `Detection for "${q}".`],
    [sessionId, `Session ${h % 90}`, "session", "Auth session."],
  ]

  const nodes = nodeSpecs.map(([id, label, kind, summary], index) =>
    createNode(id, label, kind, index, nodeSpecs.length, summary),
  )

  const edges = [
    createEdge(`${focusUser}-${sessionId}`, focusUser, sessionId, "authenticates-to", "opened session", 2),
    createEdge(`${sessionId}-${focusHost}`, sessionId, focusHost, "observed-on", "observed on source", 1),
    createEdge(`${focusHost}-${destHost}`, focusHost, destHost, "source-to-destination", "source → destination", 3),
    createEdge(`${ipId}-${focusHost}`, ipId, focusHost, "communicates-with", "network origin", 1),
    createEdge(`${detectionId}-${alertId}`, detectionId, alertId, "triggered-alert", "triggered group", 2),
    createEdge(`${alertId}-${focusUser}`, alertId, focusUser, "related-to", "related identity", 1),
    createEdge(`${alertId}-${destHost}`, alertId, destHost, "related-to", "related destination", 1),
  ]

  return { edges, nodes }
}

function buildExpansion(input: HuntGraphAdapterExpansion) {
  const h = hashInput(`${input.node.id}:${input.query}`)
  const processId = `process-${h % 97}`
  const domainId = `domain-${h % 37}`
  const detectionId = `expansion-sigma-${h % 111}`

  const nextNodes: HuntGraphNode[] = [
    createNode(processId, `powershell_${h % 20}.exe`, "process", 0, 3, "Expanded process pivot."),
    createNode(domainId, `dc${h % 8}.corp.example`, "domain", 1, 3, "Expanded DNS pivot."),
    createNode(detectionId, `Sigma Expansion ${h % 40}`, "detection", 2, 3, "Expansion detection."),
  ]
  const nextEdges: HuntGraphEdge[] = [
    createEdge(`${input.node.id}-${processId}`, input.node.id, processId, "observed-on", "expanded process", 1),
    createEdge(`${processId}-${domainId}`, processId, domainId, "communicates-with", "domain lookup", 1),
    createEdge(`${detectionId}-${processId}`, detectionId, processId, "triggered-alert", "new match", 1),
  ]

  return {
    edges: dedupeEdges([...input.currentEdges, ...nextEdges]),
    nodes: dedupeNodes([...input.currentNodes, ...nextNodes]),
  }
}

export const mockedSigmaAdapter: HuntGraphAdapter = {
  async buildInitialGraph(input: HuntGraphAdapterQuery) {
    const graph = buildMockGraph(input.query)
    return {
      adapterId: "mocked-sigma",
      edges: graph.edges,
      nodes: graph.nodes,
      summary: "Mocked Sigma datasource — normalizes results into source, destination, and alert relationships.",
    }
  },
  description:
    "Local adapter simulating Sigma-oriented datasource output. Replace with a real datasource integration.",
  async expandFromNode(input: HuntGraphAdapterExpansion) {
    const graph = buildExpansion(input)
    return {
      adapterId: "mocked-sigma",
      edges: graph.edges,
      nodes: graph.nodes,
      summary: `Expanded "${input.node.label}" with process and infrastructure pivots.`,
    }
  },
  id: "mocked-sigma",
  title: "Mocked Sigma Datasource",
}

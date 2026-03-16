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
  host: "#0f766e",
  identity: "#1d4ed8",
  ip: "#0ea5e9",
  process: "#334155",
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
    id,
    kind,
    label,
    size:
      kind === "alert-group" || kind === "detection"
        ? 17
        : kind === "host" || kind === "user"
          ? 15
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
    id,
    kind,
    label,
    source,
    summary,
    target,
    weight,
  }
}

function buildMockGraph(query: string) {
  const trimmedQuery = query.trim() || "suspicious lateral movement"
  const hash = hashInput(trimmedQuery)
  const focusHost = `host-${hash % 7}`
  const focusUser = `user-${hash % 5}`
  const destinationHost = `target-${(hash + 3) % 9}`
  const alertId = `alert-${hash % 11}`
  const detectionId = `sigma-${hash % 13}`
  const ipId = `ip-${hash % 17}`
  const sessionId = `session-${hash % 19}`

  const nodeSpecs: Array<[string, string, HuntNodeKind, string]> = [
    [
      focusUser,
      `svc-${(hash % 4) + 1}-ops`,
      "user",
      `Identity repeatedly referenced by the hunt query "${trimmedQuery}".`,
    ],
    [
      focusHost,
      `win-prod-${(hash % 6) + 11}`,
      "host",
      "Primary source host linked to the most suspicious activity cluster.",
    ],
    [
      destinationHost,
      `db-core-${(hash % 5) + 3}`,
      "host",
      "Likely destination host reached shortly after the initial authentication sequence.",
    ],
    [
      ipId,
      `10.24.${hash % 20}.${(hash % 200) + 10}`,
      "ip",
      "Network source repeatedly associated with the same chain of events.",
    ],
    [
      alertId,
      `Alert Group ${hash % 50}`,
      "alert-group",
      "Shared alert cluster derived from a Sigma-oriented correlation step.",
    ],
    [
      detectionId,
      `Sigma Match ${hash % 80}`,
      "detection",
      `Normalized Sigma-style detection generated from the datasource output for "${trimmedQuery}".`,
    ],
    [
      sessionId,
      `Session ${hash % 90}`,
      "session",
      "Authentication session linking the source identity, network origin, and target host.",
    ],
  ]

  const nodes = nodeSpecs.map(([id, label, kind, summary], index) =>
    createNode(id, label, kind, index, nodeSpecs.length, summary),
  )

  const edges = [
    createEdge(
      `${focusUser}-${sessionId}`,
      focusUser,
      sessionId,
      "authenticates-to",
      "opened session",
      2,
      "User credentials established the suspicious session.",
    ),
    createEdge(
      `${sessionId}-${focusHost}`,
      sessionId,
      focusHost,
      "observed-on",
      "observed on source host",
      1,
      "The session was observed on the initial source host.",
    ),
    createEdge(
      `${focusHost}-${destinationHost}`,
      focusHost,
      destinationHost,
      "source-to-destination",
      "source -> destination",
      3,
      "The core Sigma relationship: source host to destination host.",
    ),
    createEdge(
      `${ipId}-${focusHost}`,
      ipId,
      focusHost,
      "communicates-with",
      "network origin",
      1,
      "The IP communicates with the source host shortly before the move.",
    ),
    createEdge(
      `${detectionId}-${alertId}`,
      detectionId,
      alertId,
      "triggered-alert",
      "triggered group",
      2,
      "The Sigma rule contributed directly to the alert cluster.",
    ),
    createEdge(
      `${alertId}-${focusUser}`,
      alertId,
      focusUser,
      "related-to",
      "related identity",
      1,
      "The grouped alert materially references the same identity.",
    ),
    createEdge(
      `${alertId}-${destinationHost}`,
      alertId,
      destinationHost,
      "related-to",
      "related destination",
      1,
      "The alert cluster also references the destination host.",
    ),
  ]

  return {
    edges,
    nodes,
  }
}

function dedupeNodes(nodes: HuntGraphNode[]) {
  return Array.from(new Map(nodes.map((node) => [node.id, node])).values())
}

function dedupeEdges(edges: HuntGraphEdge[]) {
  return Array.from(new Map(edges.map((edge) => [edge.id, edge])).values())
}

function buildExpansion(input: HuntGraphAdapterExpansion) {
  const expansionHash = hashInput(`${input.node.id}:${input.query}`)
  const processId = `process-${expansionHash % 97}`
  const domainId = `domain-${expansionHash % 37}`
  const detectionId = `expansion-sigma-${expansionHash % 111}`
  const nextNodes: HuntGraphNode[] = [
    createNode(
      processId,
      `powershell_${expansionHash % 20}.exe`,
      "process",
      0,
      3,
      "Expanded process pivot connected to the selected node.",
    ),
    createNode(
      domainId,
      `dc${expansionHash % 8}.corp.example`,
      "domain",
      1,
      3,
      "Expanded DNS or identity infrastructure pivot.",
    ),
    createNode(
      detectionId,
      `Sigma Expansion ${expansionHash % 40}`,
      "detection",
      2,
      3,
      "Additional Sigma-style correlation produced from the expansion pivot.",
    ),
  ]
  const nextEdges: HuntGraphEdge[] = [
    createEdge(
      `${input.node.id}-${processId}`,
      input.node.id,
      processId,
      "observed-on",
      "expanded process",
      1,
      "Expansion from the selected node uncovered process execution.",
    ),
    createEdge(
      `${processId}-${domainId}`,
      processId,
      domainId,
      "communicates-with",
      "domain lookup",
      1,
      "The process resolved or contacted the expanded domain.",
    ),
    createEdge(
      `${detectionId}-${processId}`,
      detectionId,
      processId,
      "triggered-alert",
      "new match",
      1,
      "The additional Sigma match references the expanded process.",
    ),
  ]

  return {
    edges: dedupeEdges([...input.currentEdges, ...nextEdges]),
    nodes: dedupeNodes([...input.currentNodes, ...nextNodes]),
  }
}

const mockedDatasourceAdapter: HuntGraphAdapter = {
  async buildInitialGraph(input: HuntGraphAdapterQuery) {
    const graph = buildMockGraph(input.query)

    return {
      adapterId: "mocked-sigma",
      edges: graph.edges,
      nodes: graph.nodes,
      summary:
        "Mocked Sigma-oriented datasource that normalizes results into source, destination, entity, and alert relationships.",
    }
  },
  description:
    "A local adapter that simulates Sigma-oriented datasource output and normalizes it into collaboration-ready graph edges.",
  async expandFromNode(input: HuntGraphAdapterExpansion) {
    const graph = buildExpansion(input)

    return {
      adapterId: "mocked-sigma",
      edges: graph.edges,
      nodes: graph.nodes,
      summary: `Expanded ${input.node.label} with additional process and infrastructure pivots.`,
    }
  },
  id: "mocked-sigma",
  title: "Mocked Sigma Datasource",
}

const adapters = [mockedDatasourceAdapter]

export function getHuntGraphAdapters() {
  return adapters
}

export function getHuntGraphAdapter(adapterId: string | null) {
  if (!adapterId) {
    return null
  }

  return adapters.find((adapter) => adapter.id === adapterId) ?? null
}

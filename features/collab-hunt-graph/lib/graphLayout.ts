import type Graph from "graphology"
import forceAtlas2 from "graphology-layout-forceatlas2"
import type Sigma from "sigma"

export type NodePosition = { x: number; y: number }

export const LAYOUT_ITERATIONS_PER_FRAME = 12

// Build FA2 settings tuned for visual cluster separation.
// Uses inferSettings as a base (auto-tunes repulsion for graph size), then
// overrides gravity and enables linLogMode + outbound distribution which
// dramatically improves cluster spread on hub-and-spoke security graphs.
export function buildLayoutSettings(graph: Graph) {
  const inferred = forceAtlas2.inferSettings(graph)

  return {
    ...inferred,
    // LinLog mode uses a logarithmic attraction model: nodes in tight clusters
    // stay together while different clusters push apart clearly.
    linLogMode: true,
    // Distribute attraction force by node degree: high-degree hubs repel
    // their neighbours less aggressively, giving a better spread.
    outboundAttractionDistribution: true,
    // Barnes-Hut approximation: more accurate long-range repulsion which
    // is the main force separating clusters visually.
    barnesHutOptimize: true,
    barnesHutTheta: 0.5,
    // Very low gravity so clusters can drift well apart from the centre.
    gravity: 0.05,
    // Higher scaling ratio = stronger repulsion between unconnected nodes.
    scalingRatio: 4,
    // Slower convergence gives smoother, more readable animation.
    slowDown: 8,
    strongGravityMode: false,
  }
}

// Place every node evenly on a circle of the given radius before running FA2.
// FA2 is highly sensitive to initial positions — starting from a tight cluster
// (radius ~10) means it never separates groups properly. Spreading to radius
// ~150 gives the algorithm room to work.
export function preSpreadNodes(graph: Graph, radius = 150): void {
  const nodes = graph.nodes()
  const count = nodes.length
  if (count === 0) return

  nodes.forEach((nodeId, index) => {
    const angle = (2 * Math.PI * index) / count
    graph.setNodeAttribute(nodeId, "x", Math.cos(angle) * radius)
    graph.setNodeAttribute(nodeId, "y", Math.sin(angle) * radius)
  })
}

// Capture current x/y for every node in the Sigma graph
export function snapshotNodePositions(graph: Graph): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>()

  graph.forEachNode((nodeId, attrs) => {
    if (typeof attrs.x === "number" && typeof attrs.y === "number") {
      positions.set(nodeId, { x: attrs.x, y: attrs.y })
    }
  })

  return positions
}

// Restore previously snapshotted positions back onto a graph
export function restoreNodePositions(graph: Graph, positions: Map<string, NodePosition>): void {
  graph.forEachNode((nodeId) => {
    const pos = positions.get(nodeId)
    if (pos) {
      graph.setNodeAttribute(nodeId, "x", pos.x)
      graph.setNodeAttribute(nodeId, "y", pos.y)
    }
  })
}

// Run a single ForceAtlas2 iteration batch and refresh Sigma
export function runLayoutStep(
  graph: Graph,
  sigma: Sigma,
  settings: ReturnType<typeof buildLayoutSettings>,
): void {
  try {
    forceAtlas2.assign(graph, {
      iterations: LAYOUT_ITERATIONS_PER_FRAME,
      settings,
    })
    sigma.refresh()
  } catch {
    // Graph may be in an intermediate state — skip this frame
  }
}

// Hide all edges on a graphology graph (used during layout for perf)
export function hideAllEdges(graph: Graph): void {
  graph.forEachEdge((edgeId) => {
    graph.setEdgeAttribute(edgeId, "hidden", true)
  })
}

// Restore all edges to visible
export function showAllEdges(graph: Graph): void {
  graph.forEachEdge((edgeId) => {
    graph.setEdgeAttribute(edgeId, "hidden", false)
  })
}

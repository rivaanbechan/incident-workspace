"use client"

import Graph from "graphology"
import forceAtlas2 from "graphology-layout-forceatlas2"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import Sigma from "sigma"

import { PageHeader } from "@/components/shell/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { getHuntGraphAdapters } from "@/features/collab-hunt-graph/lib/adapters"
import type {
  HuntGraphEdge,
  HuntGraphNode,
  SavedHuntGraphViewDetail,
  SavedHuntGraphViewRecord,
} from "@/features/collab-hunt-graph/lib/types"
import { useHuntGraphRoom } from "@/features/collab-hunt-graph/hooks/useHuntGraphRoom"
import type { CaseAccessContext } from "@/lib/auth/permissions"
import type { InvestigationArtifact } from "@/lib/contracts/artifacts"
import type { EntityKind, EntityRef } from "@/lib/contracts/entities"

type HuntGraphRoomClientProps = {
  currentUser: CaseAccessContext
  initialEntityFocus: {
    id: string
    kind: string | null
    label: string
    value: string
  } | null
  initialSavedViews: SavedHuntGraphViewRecord[]
  initialView: SavedHuntGraphViewDetail | null
  roomId: string
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function buildEmptyStateMessage(nodes: HuntGraphNode[], edges: HuntGraphEdge[]) {
  if (nodes.length === 0 && edges.length === 0) {
    return "No graph data has been loaded into this room yet."
  }

  return "Current filters hide every node or edge in the graph."
}

const entityKinds = new Set([
  "account",
  "alert",
  "cloud-resource",
  "domain",
  "file",
  "host",
  "identity",
  "ip",
  "process",
  "service",
  "url",
  "user",
])

function toEntityRef(node: HuntGraphNode): EntityRef | null {
  if (!entityKinds.has(node.kind)) {
    return null
  }

  return {
    id: node.id,
    kind: node.kind as EntityKind,
    label: node.label,
    sourceModule: "collab-hunt-graph",
  }
}

export function HuntGraphRoomClient({
  currentUser,
  initialEntityFocus,
  initialSavedViews,
  initialView,
  roomId,
}: HuntGraphRoomClientProps) {
  const adapters = getHuntGraphAdapters()
  const graphContainerRef = useRef<HTMLDivElement | null>(null)
  const sigmaRef = useRef<Sigma | null>(null)

  const [savedViews, setSavedViews] = useState(initialSavedViews)
  const [saveTitle, setSaveTitle] = useState(
    initialView ? `${initialView.title} Copy` : "",
  )
  const [noteDraft, setNoteDraft] = useState("")
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [isPromotingArtifact, setIsPromotingArtifact] = useState(false)

  const {
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
    userName,
    addNote,
  } = useHuntGraphRoom(roomId, initialView, currentUser)

  const pinnedNodeIdSet = useMemo(() => new Set(pinnedNodeIds), [pinnedNodeIds])
  const pinnedEdgeIdSet = useMemo(() => new Set(pinnedEdgeIds), [pinnedEdgeIds])

  useEffect(() => {
    if (initialEntityFocus && !initialView && adapterId) {
      setAdapterAndQuery(adapterId, initialEntityFocus.value)
    }
  }, [adapterId, initialEntityFocus, initialView, setAdapterAndQuery])

  useEffect(() => {
    const container = graphContainerRef.current

    if (!container) {
      return
    }

    if (filteredNodes.length === 0) {
      sigmaRef.current?.kill()
      sigmaRef.current = null
      container.innerHTML = ""
      return
    }

    const graph = new Graph()

    filteredNodes.forEach((node, index) => {
      graph.addNode(node.id, {
        color:
          selectedNodeId === node.id
            ? "hsl(var(--critical))"
            : pinnedNodeIdSet.has(node.id)
              ? "hsl(var(--foreground))"
              : node.color,
        label: node.label,
        size: pinnedNodeIdSet.has(node.id) ? node.size + 3 : node.size,
        x: node.x ?? Math.cos(index) * 10,
        y: node.y ?? Math.sin(index) * 10,
      })
    })

    filteredEdges.forEach((edge) => {
      if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) {
        return
      }

      graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
        color:
          selectedEdgeId === edge.id
            ? "hsl(var(--critical))"
            : pinnedEdgeIdSet.has(edge.id)
              ? "hsl(var(--foreground))"
              : edge.color,
        label: edge.label,
        size: pinnedEdgeIdSet.has(edge.id) ? edge.weight + 1 : edge.weight,
      })
    })

    sigmaRef.current?.kill()
    const sigma = new Sigma(graph, container, {
      allowInvalidContainer: true,
      renderEdgeLabels: true,
      renderLabels: true,
    })

    sigma.on("clickNode", ({ node }) => {
      setSelectedNodeId(node)
      setSelectedEdgeId(null)
    })
    sigma.on("clickEdge", ({ edge }) => {
      setSelectedNodeId(null)
      setSelectedEdgeId(edge)
    })
    sigma.on("clickStage", () => {
      setSelectedNodeId(null)
      setSelectedEdgeId(null)
    })

    let frameId = 0

    if (graph.order > 1) {
      let stepsRemaining = 24

      const animateLayout = () => {
        try {
          forceAtlas2.assign(graph, {
            iterations: 6,
            settings: {
              gravity: 0.6,
              scalingRatio: 22,
              slowDown: 1.4,
            },
          })
          sigma.refresh()
        } catch {
          stepsRemaining = 0
        }

        stepsRemaining -= 1

        if (stepsRemaining > 0) {
          frameId = window.requestAnimationFrame(animateLayout)
        }
      }

      frameId = window.requestAnimationFrame(animateLayout)
    }

    sigmaRef.current = sigma

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }
      sigma.kill()
      if (sigmaRef.current === sigma) {
        sigmaRef.current = null
      }
    }
  }, [
    filteredEdges,
    filteredNodes,
    pinnedEdgeIdSet,
    pinnedNodeIdSet,
    selectedEdgeId,
    selectedNodeId,
    setSelectedEdgeId,
    setSelectedNodeId,
  ])

  useEffect(() => {
    if (!initialEntityFocus || snapshot.nodes.length === 0) {
      return
    }

    const needle = initialEntityFocus.value.trim().toLowerCase()
    const matched = snapshot.nodes.find((node) => {
      const kindMatches = initialEntityFocus.kind ? node.kind === initialEntityFocus.kind : true

      return (
        kindMatches &&
        (node.id.toLowerCase() === needle || node.label.toLowerCase().includes(needle))
      )
    })

    if (matched) {
      setSelectedNodeId(matched.id)
      setSelectedEdgeId(null)
    }
  }, [initialEntityFocus, setSelectedEdgeId, setSelectedNodeId, snapshot.nodes])

  const selectedItem = selectedNode ?? selectedEdge ?? null
  const selectedItemType = selectedNode ? "node" : selectedEdge ? "edge" : null

  const ensureSavedView = async () => {
    if (activeSavedViewId) {
      return activeSavedViewId
    }

    const generatedTitle = (selectedNode?.label || selectedEdge?.label || "Shared hunt view")
      .replace(/\s+/g, " ")
      .trim()

    const response = await fetch(`/api/hunt/${roomId}/views`, {
      body: JSON.stringify({
        snapshot,
        title: generatedTitle,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    })

    if (!response.ok) {
      throw new Error("Unable to save the current graph before promotion.")
    }

    const savedView = (await response.json()) as SavedHuntGraphViewDetail
    loadSavedView(savedView)
    window.history.replaceState(
      {},
      "",
      `/hunt/${roomId}?view=${encodeURIComponent(savedView.id)}`,
    )
    await refreshSavedViews()

    return savedView.id
  }

  const refreshSavedViews = async () => {
    const response = await fetch(`/api/hunt/${roomId}/views`, {
      cache: "no-store",
    })

    if (!response.ok) {
      return
    }

    const nextViews = (await response.json()) as SavedHuntGraphViewRecord[]
    setSavedViews(nextViews)
  }

  const handleSaveView = async () => {
    const title = saveTitle.trim()

    if (!title) {
      setSaveStatus("Enter a title before saving the current graph view.")
      return
    }

    const response = await fetch(`/api/hunt/${roomId}/views`, {
      body: JSON.stringify({
        snapshot,
        title,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      setSaveStatus(payload?.error || "Unable to save this graph view.")
      return
    }

    const savedView = (await response.json()) as SavedHuntGraphViewDetail
    loadSavedView(savedView)
    setSaveStatus(`Saved "${savedView.title}".`)
    setSaveTitle(savedView.title)
    window.history.replaceState(
      {},
      "",
      `/hunt/${roomId}?view=${encodeURIComponent(savedView.id)}`,
    )
    await refreshSavedViews()
  }

  const handleOpenSavedView = async (viewId: string) => {
    const response = await fetch(`/api/hunt/${roomId}/views/${viewId}`, {
      cache: "no-store",
    })

    if (!response.ok) {
      setSaveStatus("Unable to load that saved graph view.")
      return
    }

    const savedView = (await response.json()) as SavedHuntGraphViewDetail
    loadSavedView(savedView)
    setSaveTitle(savedView.title)
    setSaveStatus(`Opened "${savedView.title}".`)
    window.history.replaceState(
      {},
      "",
      `/hunt/${roomId}?view=${encodeURIComponent(savedView.id)}`,
    )
  }

  const handleCopyDeepLink = async (viewId: string) => {
    const shareUrl = `${window.location.origin}/hunt/${roomId}?view=${encodeURIComponent(
      viewId,
    )}`

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl)
      setSaveStatus("Copied a saved-view deep link to the clipboard.")
      return
    }

    setSaveStatus(shareUrl)
  }

  const handlePromoteArtifact = async () => {
    if (!selectedItem) {
      setSaveStatus("Select a node or edge before promoting a finding.")
      return
    }

    setIsPromotingArtifact(true)

    try {
      const savedViewId = await ensureSavedView()
      const deepLinkHref = `/hunt/${roomId}?view=${encodeURIComponent(savedViewId)}`
      const relatedEntities = selectedNode
        ? [toEntityRef(selectedNode)].filter((entity): entity is EntityRef => entity !== null)
        : selectedEdge
          ? snapshot.nodes
              .filter(
                (node) =>
                  node.id === selectedEdge.source || node.id === selectedEdge.target,
              )
              .map(toEntityRef)
              .filter((entity): entity is EntityRef => entity !== null)
          : []

      const artifact: InvestigationArtifact = {
        createdAt: Date.now(),
        deepLink: {
          contextId: savedViewId,
          href: deepLinkHref,
          moduleId: "collab-hunt-graph",
          params: {
            roomId,
            view: savedViewId,
          },
        },
        id: crypto.randomUUID(),
        kind: selectedNode ? "finding" : "graph-selection",
        payload: {
          adapterId,
          query,
          roomId,
          savedViewId,
          selectedEdgeId: selectedEdge?.id ?? null,
          selectedNodeId: selectedNode?.id ?? null,
        },
        relatedEntities,
        sourceModule: "collab-hunt-graph",
        summary:
          selectedItem.summary ||
          `Promoted ${selectedItemType} from the collaborative hunt graph.`,
        title:
          selectedNode?.label ||
          selectedEdge?.label ||
          "Shared hunt finding",
      }

      const response = await fetch(`/api/rooms/${roomId}/artifacts`, {
        body: JSON.stringify({ artifact }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null

        throw new Error(payload?.error || "Unable to promote the finding.")
      }

      setSaveStatus("Promoted the finding into the incident workspace.")
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Unable to promote finding.")
    } finally {
      setIsPromotingArtifact(false)
    }
  }

  const handleAddNote = () => {
    const trimmed = noteDraft.trim()

    if (!trimmed) {
      return
    }

    addNote(trimmed)
    setNoteDraft("")
  }

  return (
    <div className="h-full overflow-auto p-5">
      <div className="grid gap-5">
        <PageHeader
          eyebrow="Collaborative Hunt Graph"
          title={`Room ${roomId}`}
          description="Shared Sigma-oriented graph exploration with room-backed collaboration and datasource adapters."
          actions={
            <Button asChild>
              <Link href={`/board/${roomId}`}>Open Incident Workspace</Link>
            </Button>
          }
          badges={
            <>
              <Badge className="bg-info/15 text-info">Status {connectionStatus}</Badge>
              <Badge variant="secondary">Collaborator {userName}</Badge>
              <Badge variant="outline">
                Active view {activeSavedViewId || "unsaved shared session"}
              </Badge>
            </>
          }
        />

        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)_320px]">
          <aside className="grid content-start gap-4">
            <Card className="border-border/60 bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Datasource</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="adapter">Adapter</Label>
                  <Select
                    id="adapter"
                    onChange={(event) => setAdapterAndQuery(event.target.value, query)}
                    value={adapterId ?? ""}
                  >
                    {adapters.map((adapter) => (
                      <option key={adapter.id} value={adapter.id}>
                        {adapter.title}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hunt-query">Hunt query</Label>
                  <Textarea
                    id="hunt-query"
                    onChange={(event) =>
                      setAdapterAndQuery(adapterId ?? "mocked-sigma", event.target.value)
                    }
                    placeholder="kerberos lateral movement from tier-0 hosts"
                    rows={4}
                    value={query}
                  />
                </div>
                <Button onClick={loadGraphFromAdapter} type="button">
                  Load Shared Graph
                </Button>
                <Button onClick={expandSelectedNode} type="button" variant="outline">
                  Expand Selected Node
                </Button>
                <CardDescription className="text-sm leading-6">
                  {adapters.find((adapter) => adapter.id === adapterId)?.description}
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Saved Views</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Input
                  onChange={(event) => setSaveTitle(event.target.value)}
                  placeholder="Quarterly auth pivot"
                  value={saveTitle}
                />
                <Button
                  className="bg-success hover:bg-success/90"
                  onClick={handleSaveView}
                  type="button"
                >
                  Save Shared View
                </Button>
                {saveStatus ? (
                  <div className="text-sm leading-6 text-success">{saveStatus}</div>
                ) : null}
                <div className="grid gap-3">
                  {savedViews.length > 0 ? (
                    savedViews.map((view) => (
                      <article
                        key={view.id}
                        className={`rounded-2xl border p-3 ${
                          activeSavedViewId === view.id
                            ? "border-foreground bg-muted"
                            : "border-border bg-card"
                        }`}
                      >
                        <div className="font-semibold text-foreground">{view.title}</div>
                        <div className="mt-2 text-xs leading-5 text-muted-foreground">
                          {view.nodeCount} nodes, {view.edgeCount} edges
                          <br />
                          {formatTimestamp(view.updatedAt)}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button onClick={() => handleOpenSavedView(view.id)} size="sm" type="button">
                            Open
                          </Button>
                          <Button
                            onClick={() => handleCopyDeepLink(view.id)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            Copy Link
                          </Button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="text-sm leading-6 text-muted-foreground">
                      No saved graph views yet for this room.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </aside>

          <section className="grid content-start gap-4">
            <Card className="border-border/60 bg-card shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="space-y-2">
                  <CardDescription className="text-xs font-semibold uppercase tracking-[0.18em]">
                    Shared graph canvas
                  </CardDescription>
                  <CardTitle>Force-directed relationship view</CardTitle>
                </div>
                <CardDescription className="max-w-xs text-right text-sm leading-6">
                  {statusMessage}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div
                  ref={graphContainerRef}
                  className="relative min-h-[520px] overflow-hidden rounded-2xl border border-border/70 bg-muted"
                  style={{
                    background:
                      "radial-gradient(circle at 20% 20%, hsl(var(--info) / 0.08), transparent 24%), hsl(var(--card))",
                  }}
                />
                {filteredNodes.length === 0 ? (
                  <div className="text-sm leading-6 text-muted-foreground">
                    {buildEmptyStateMessage(snapshot.nodes, snapshot.edges)}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Shared filters</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <div className="text-sm font-semibold text-muted-foreground">Node kinds</div>
                  {availableNodeKinds.map((kind) => {
                    const enabled =
                      snapshot.filters.nodeKinds.length === 0 ||
                      snapshot.filters.nodeKinds.includes(kind)

                    return (
                      <label key={kind} className="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={enabled}
                          onCheckedChange={(checked) => setNodeKindEnabled(kind, checked === true)}
                        />
                        <span>{kind}</span>
                      </label>
                    )
                  })}
                </div>

                <div className="grid gap-2">
                  <div className="text-sm font-semibold text-muted-foreground">Edge kinds</div>
                  {availableEdgeKinds.map((kind) => {
                    const enabled =
                      snapshot.filters.edgeKinds.length === 0 ||
                      snapshot.filters.edgeKinds.includes(kind)

                    return (
                      <label key={kind} className="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={enabled}
                          onCheckedChange={(checked) => setEdgeKindEnabled(kind, checked === true)}
                        />
                        <span>{kind}</span>
                      </label>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </section>

          <aside className="grid content-start gap-4">
            <Card className="border-border/60 bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Selection</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {selectedItem ? (
                  <>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {selectedItemType}
                    </div>
                    <div className="text-2xl font-semibold text-foreground">
                      {selectedItem.label}
                    </div>
                    <div className="text-sm leading-6 text-muted-foreground">
                      {selectedItem.summary || "No summary available for this graph item yet."}
                    </div>
                    <Button
                      onClick={() =>
                        selectedNode
                          ? togglePinnedNode(selectedNode.id)
                          : selectedEdge
                            ? togglePinnedEdge(selectedEdge.id)
                            : null
                      }
                      type="button"
                      variant="outline"
                    >
                      {selectedNode
                        ? pinnedNodeIdSet.has(selectedNode.id)
                          ? "Unpin Node"
                          : "Pin Node"
                        : selectedEdge
                          ? pinnedEdgeIdSet.has(selectedEdge.id)
                            ? "Unpin Edge"
                            : "Pin Edge"
                          : "Pin"}
                    </Button>
                    <Button
                      className="bg-success hover:bg-success/90"
                      disabled={isPromotingArtifact}
                      onClick={handlePromoteArtifact}
                      type="button"
                    >
                      {isPromotingArtifact ? "Promoting..." : "Promote to Incident Workspace"}
                    </Button>
                  </>
                ) : (
                  <div className="text-sm leading-6 text-muted-foreground">
                    Select a node or edge from the graph to inspect it and add shared notes.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Shared notes</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Textarea
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="Analyst note tied to the current graph selection"
                  rows={4}
                  value={noteDraft}
                />
                <Button onClick={handleAddNote} type="button">
                  Add Shared Note
                </Button>
                <div className="grid gap-3">
                  {selectedNotes.length > 0 ? (
                    selectedNotes.map((note) => (
                      <article key={note.id} className="rounded-2xl bg-muted p-3">
                        <div className="text-xs font-semibold text-foreground">{note.authorName}</div>
                        <div className="mt-2 text-sm leading-6 text-muted-foreground">
                          {note.body}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {new Intl.DateTimeFormat("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(note.createdAt)}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="text-sm leading-6 text-muted-foreground">
                      No shared notes for the current selection yet.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useHuntGraphRoom } from "@/features/collab-hunt-graph/hooks/useHuntGraphRoom"
import { HuntGraphCanvas } from "@/features/collab-hunt-graph/components/HuntGraphCanvas"
import { HuntGraphFiltersPanel } from "@/features/collab-hunt-graph/components/HuntGraphFiltersPanel"
import { HuntGraphNodePanel } from "@/features/collab-hunt-graph/components/HuntGraphNodePanel"
import { HuntGraphQueryPanel } from "@/features/collab-hunt-graph/components/HuntGraphQueryPanel"
import { HuntGraphSavedViewsPanel } from "@/features/collab-hunt-graph/components/HuntGraphSavedViewsPanel"
import { HuntGraphTimelineScrubber } from "@/features/collab-hunt-graph/components/HuntGraphTimelineScrubber"
import type { SavedHuntGraphViewDetail, SavedHuntGraphViewRecord } from "@/features/collab-hunt-graph/lib/types"
import { PageHeader } from "@/components/shell/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { CaseAccessContext } from "@/lib/auth/permissions"
import Link from "next/link"
import { useState } from "react"

type HuntGraphRoomClientProps = {
  currentUser: CaseAccessContext
  initialSavedViews: SavedHuntGraphViewRecord[]
  initialView: SavedHuntGraphViewDetail | null
  roomId: string
}

export function HuntGraphRoomClient({
  currentUser,
  initialSavedViews,
  initialView,
  roomId,
}: HuntGraphRoomClientProps) {
  const [savedViews, setSavedViews] = useState(initialSavedViews)
  const [isBuilding, setIsBuilding] = useState(false)

  const room = useHuntGraphRoom(roomId, initialView, currentUser)

  const {
    activeSavedViewId,
    addNote,
    applySnapshot,
    availableEdgeKinds,
    availableNodeKinds,
    buildGraph,
    connectionStatus,
    datasource,
    deleteNode,
    edges,
    expandSelectedNode,
    filteredEdges,
    filteredNodes,
    filters,
    graphStatusMessage,
    layout,
    nodes,
    notes,
    pinnedEdgeIds,
    pinnedNodeIds,
    selectedEdge,
    selectedEdgeId,
    selectedNode,
    selectedNodeId,
    selectedNotes,
    setEdgeKindEnabled,
    setNodeKindEnabled,
    setSelectedEdgeId,
    setSelectedNodeId,
    snapshot,
    timeline,
    togglePinnedEdge,
    togglePinnedNode,
    userName,
  } = room

  const handleBuildGraph = async () => {
    setIsBuilding(true)
    try {
      await buildGraph()
    } finally {
      setIsBuilding(false)
    }
  }

  const handleSaveView = async (title: string): Promise<SavedHuntGraphViewDetail> => {
    const { apiRequest } = await import("@/lib/api/client")
    const view = await apiRequest<SavedHuntGraphViewDetail>(`/api/hunt/${roomId}/views`, {
      body: JSON.stringify({ snapshot, title }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
    applySnapshot(view.snapshot)
    return view
  }

  return (
    <div className="h-full overflow-auto p-5">
      <div className="grid gap-5">
        <PageHeader
          actions={
            <Button asChild>
              <Link href={`/board/${roomId}`}>Incident Workspace</Link>
            </Button>
          }
          badges={
            <>
              <Badge className="bg-info/15 text-info">
                {connectionStatus === "connected" ? "Live" : connectionStatus}
              </Badge>
              <Badge variant="secondary">{userName}</Badge>
              {activeSavedViewId && (
                <Badge variant="outline">View saved</Badge>
              )}
            </>
          }
          description="Collaborative graph investigation. Query a datasource, map columns to edges, and explore relationships together."
          eyebrow="Hunt Graph"
          title={`Room ${roomId}`}
        />

        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)_320px]">
          <aside className="grid content-start gap-4">
            <HuntGraphQueryPanel
              datasource={datasource}
              hasSelectedNode={selectedNodeId !== null}
              isBuilding={isBuilding}
              onBuildGraph={() => { void handleBuildGraph() }}
              onExpandNode={() => { void expandSelectedNode() }}
            />
            <HuntGraphSavedViewsPanel
              activeSavedViewId={activeSavedViewId}
              onLoadView={(view) => applySnapshot(view.snapshot)}
              onViewsChange={setSavedViews}
              roomId={roomId}
              savedViews={savedViews}
              snapshot={snapshot}
            />
          </aside>

          <section className="grid content-start gap-4">
            <HuntGraphCanvas
              edges={filteredEdges}
              isLayoutRunning={layout.isLayoutRunning}
              nodes={filteredNodes}
              onEdgeClick={(id) => { setSelectedEdgeId(id); setSelectedNodeId(null) }}
              onNodeClick={(id) => { setSelectedNodeId(id); setSelectedEdgeId(null) }}
              onStageClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null) }}
              pinnedEdgeIds={pinnedEdgeIds}
              pinnedNodeIds={pinnedNodeIds}
              registerCanvas={layout.registerCanvas}
              selectedEdgeId={selectedEdgeId}
              selectedNodeId={selectedNodeId}
              statusMessage={graphStatusMessage}
              toggleLayout={layout.toggleLayout}
              unregisterCanvas={layout.unregisterCanvas}
            />
            <HuntGraphFiltersPanel
              availableEdgeKinds={availableEdgeKinds}
              availableNodeKinds={availableNodeKinds}
              filters={filters}
              setEdgeKindEnabled={setEdgeKindEnabled}
              setNodeKindEnabled={setNodeKindEnabled}
            />
            <HuntGraphTimelineScrubber timeline={timeline} />
          </section>

          <aside className="grid content-start gap-4">
            <HuntGraphNodePanel
              addNote={addNote}
              expandSelectedNode={expandSelectedNode}
              onDelete={deleteNode}
              onSaveView={handleSaveView}
              pinnedEdgeIds={pinnedEdgeIds}
              pinnedNodeIds={pinnedNodeIds}
              roomId={roomId}
              selectedEdge={selectedEdge}
              selectedEdgeId={selectedEdgeId}
              selectedNode={selectedNode}
              selectedNodeId={selectedNodeId}
              selectedNotes={selectedNotes}
              snapshot={snapshot}
              togglePinnedEdge={togglePinnedEdge}
              togglePinnedNode={togglePinnedNode}
              userName={userName}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}

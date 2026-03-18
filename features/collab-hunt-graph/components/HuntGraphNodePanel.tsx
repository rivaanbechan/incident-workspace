"use client"

import type { HuntGraphRoom } from "@/features/collab-hunt-graph/hooks/useHuntGraphRoom"
import type { HuntGraphSnapshot, SavedHuntGraphViewDetail } from "@/features/collab-hunt-graph/lib/types"
import type { EntityKind, EntityRef } from "@/lib/contracts/entities"
import type { InvestigationArtifact } from "@/lib/contracts/artifacts"
import { apiRequest } from "@/lib/api/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { formatTimestamp } from "@/lib/ui/formatters"
import { useCallback, useState } from "react"

const PROMOTABLE_KINDS = new Set([
  "account", "alert", "cloud-resource", "domain", "file",
  "host", "identity", "ip", "process", "service", "url", "user",
])

function toEntityRef(node: HuntGraphRoom["selectedNode"]): EntityRef | null {
  if (!node || !PROMOTABLE_KINDS.has(node.kind)) return null
  return { id: node.id, kind: node.kind as EntityKind, label: node.label, sourceModule: "collab-hunt-graph" }
}

type HuntGraphNodePanelProps = {
  expandSelectedNode: HuntGraphRoom["expandSelectedNode"]
  onDelete: (nodeId: string, recursive: boolean) => void
  onSaveView: (title: string) => Promise<SavedHuntGraphViewDetail>
  pinnedEdgeIds: string[]
  pinnedNodeIds: string[]
  roomId: string
  selectedEdge: HuntGraphRoom["selectedEdge"]
  selectedNode: HuntGraphRoom["selectedNode"]
  selectedNotes: HuntGraphRoom["selectedNotes"]
  selectedEdgeId: string | null
  selectedNodeId: string | null
  snapshot: HuntGraphSnapshot
  togglePinnedEdge: HuntGraphRoom["togglePinnedEdge"]
  togglePinnedNode: HuntGraphRoom["togglePinnedNode"]
  userName: string
  addNote: (body: string, nodeId: string | null, edgeId: string | null, userName: string) => void
}

export function HuntGraphNodePanel({
  addNote,
  expandSelectedNode,
  onDelete,
  onSaveView,
  pinnedEdgeIds,
  pinnedNodeIds,
  roomId,
  selectedEdge,
  selectedEdgeId,
  selectedNode,
  selectedNodeId,
  selectedNotes,
  snapshot,
  togglePinnedEdge,
  togglePinnedNode,
  userName,
}: HuntGraphNodePanelProps) {
  const [noteDraft, setNoteDraft] = useState("")
  const [deleteRecursive, setDeleteRecursive] = useState(false)
  const [actionStatus, setActionStatus] = useState<string | null>(null)
  const [isPromoting, setIsPromoting] = useState(false)

  const selectedItem = selectedNode ?? selectedEdge
  const pinnedNodeSet = new Set(pinnedNodeIds)
  const pinnedEdgeSet = new Set(pinnedEdgeIds)

  const handleAddNote = () => {
    const trimmed = noteDraft.trim()
    if (!trimmed) return
    addNote(trimmed, selectedNodeId, selectedEdgeId, userName)
    setNoteDraft("")
  }

  const handleDelete = () => {
    if (!selectedNodeId) return
    onDelete(selectedNodeId, deleteRecursive)
    setActionStatus(`Deleted node${deleteRecursive ? " and descendants" : ""}.`)
  }

  const handlePromote = useCallback(async () => {
    if (!selectedItem) return
    setIsPromoting(true)
    setActionStatus(null)
    try {
      let savedViewId = snapshot.activeSavedViewId
      if (!savedViewId) {
        const view = await onSaveView(selectedNode?.label ?? selectedEdge?.label ?? "Hunt finding")
        savedViewId = view.id
      }
      const entityRef = toEntityRef(selectedNode)
      const artifact: InvestigationArtifact = {
        createdAt: Date.now(),
        deepLink: {
          contextId: savedViewId,
          href: `/hunt/${roomId}?view=${encodeURIComponent(savedViewId)}`,
          moduleId: "collab-hunt-graph",
          params: { roomId, view: savedViewId },
        },
        id: crypto.randomUUID(),
        kind: selectedNode ? "finding" : "graph-selection",
        payload: { roomId, savedViewId, selectedEdgeId, selectedNodeId },
        relatedEntities: entityRef ? [entityRef] : [],
        sourceModule: "collab-hunt-graph",
        summary: selectedItem.summary ?? `Promoted from collaborative hunt graph.`,
        title: selectedNode?.label ?? selectedEdge?.label ?? "Hunt finding",
      }
      await apiRequest(`/api/rooms/${roomId}/artifacts`, {
        body: JSON.stringify({ artifact }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
      setActionStatus("Promoted to incident workspace.")
    } catch (err) {
      setActionStatus(err instanceof Error ? err.message : "Promotion failed.")
    } finally {
      setIsPromoting(false)
    }
  }, [selectedItem, selectedNode, selectedEdge, snapshot, roomId, selectedNodeId, selectedEdgeId, onSaveView])

  return (
    <div className="grid gap-4">
      <Card className="border-border/60 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Selection</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {selectedItem ? (
            <>
              <Badge variant="outline" className="w-fit text-xs capitalize">
                {selectedNode ? `${selectedNode.origin} node` : "edge"}
              </Badge>
              <div className="text-xl font-semibold text-foreground">{selectedItem.label}</div>
              {selectedItem.summary && (
                <div className="text-sm leading-6 text-muted-foreground">{selectedItem.summary}</div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => selectedNode ? togglePinnedNode(selectedNode.id) : selectedEdge ? togglePinnedEdge(selectedEdge.id) : null}
                  size="sm" type="button" variant="outline"
                >
                  {selectedNode ? (pinnedNodeSet.has(selectedNode.id) ? "Unpin" : "Pin") : (pinnedEdgeSet.has(selectedEdge!.id) ? "Unpin" : "Pin")}
                </Button>
                {selectedNode && (
                  <Button onClick={() => { void expandSelectedNode() }} size="sm" type="button" variant="outline">
                    Expand
                  </Button>
                )}
                <Button
                  className="bg-success hover:bg-success/90"
                  disabled={isPromoting}
                  onClick={() => { void handlePromote() }}
                  size="sm" type="button"
                >
                  {isPromoting ? "Promoting…" : "Promote"}
                </Button>
              </div>

              {selectedNode && (
                <div className="flex items-center gap-3 border-t border-border/40 pt-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={deleteRecursive}
                      onCheckedChange={(c) => setDeleteRecursive(c === true)}
                    />
                    Delete descendants too
                  </label>
                  <Button
                    className="ml-auto"
                    onClick={handleDelete}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    Delete
                  </Button>
                </div>
              )}

              {actionStatus && (
                <div className="text-sm text-muted-foreground">{actionStatus}</div>
              )}
            </>
          ) : (
            <div className="text-sm leading-6 text-muted-foreground">
              Click a node or edge to inspect it, expand, delete, or promote it.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Notes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Textarea
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Shared analyst note for this selection"
            rows={3}
            value={noteDraft}
          />
          <Button
            disabled={!selectedItem || !noteDraft.trim()}
            onClick={handleAddNote}
            type="button"
          >
            Add Note
          </Button>
          <div className="grid gap-2">
            {selectedNotes.length > 0 ? (
              selectedNotes.map((note) => (
                <article key={note.id} className="rounded-xl bg-muted p-3">
                  <div className="text-xs font-semibold text-foreground">{note.authorName}</div>
                  <div className="mt-1 text-sm leading-5 text-muted-foreground">{note.body}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatTimestamp(new Date(note.createdAt).toISOString())}
                  </div>
                </article>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">
                {selectedItem ? "No notes yet for this selection." : "Select an item to view notes."}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

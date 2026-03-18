"use client"

import type { HuntGraphSnapshot, SavedHuntGraphViewDetail, SavedHuntGraphViewRecord } from "@/features/collab-hunt-graph/lib/types"
import { apiRequest } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatTimestamp } from "@/lib/ui/formatters"
import { useState } from "react"

type HuntGraphSavedViewsPanelProps = {
  activeSavedViewId: string | null
  onLoadView: (view: SavedHuntGraphViewDetail) => void
  onViewsChange: (views: SavedHuntGraphViewRecord[]) => void
  roomId: string
  savedViews: SavedHuntGraphViewRecord[]
  snapshot: HuntGraphSnapshot
}

export function HuntGraphSavedViewsPanel({
  activeSavedViewId,
  onLoadView,
  onViewsChange,
  roomId,
  savedViews,
  snapshot,
}: HuntGraphSavedViewsPanelProps) {
  const [saveTitle, setSaveTitle] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const refreshViews = async () => {
    try {
      const views = await apiRequest<SavedHuntGraphViewRecord[]>(
        `/api/hunt/${roomId}/views`,
        { cache: "no-store" },
      )
      onViewsChange(views)
    } catch {
      // Silently ignore
    }
  }

  const handleSave = async () => {
    const title = saveTitle.trim()
    if (!title) {
      setStatusMessage("Enter a title before saving.")
      return
    }
    setIsSaving(true)
    setStatusMessage(null)
    try {
      const view = await apiRequest<SavedHuntGraphViewDetail>(`/api/hunt/${roomId}/views`, {
        body: JSON.stringify({ snapshot, title }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
      onLoadView(view)
      setSaveTitle(view.title)
      setStatusMessage(`Saved "${view.title}".`)
      window.history.replaceState({}, "", `/hunt/${roomId}?view=${encodeURIComponent(view.id)}`)
      await refreshViews()
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Unable to save.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpen = async (viewId: string) => {
    try {
      const view = await apiRequest<SavedHuntGraphViewDetail>(
        `/api/hunt/${roomId}/views/${viewId}`,
        { cache: "no-store" },
      )
      onLoadView(view)
      setSaveTitle(view.title)
      setStatusMessage(`Opened "${view.title}".`)
      window.history.replaceState({}, "", `/hunt/${roomId}?view=${encodeURIComponent(view.id)}`)
    } catch {
      setStatusMessage("Unable to load saved view.")
    }
  }

  const handleCopyLink = async (viewId: string) => {
    const url = `${window.location.origin}/hunt/${roomId}?view=${encodeURIComponent(viewId)}`
    try {
      await navigator.clipboard.writeText(url)
      setStatusMessage("Deep link copied.")
    } catch {
      setStatusMessage(url)
    }
  }

  return (
    <Card className="border-border/60 bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Saved Views</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Input
          onChange={(e) => setSaveTitle(e.target.value)}
          placeholder="Q1 auth pivot"
          value={saveTitle}
        />
        <Button
          className="bg-success hover:bg-success/90"
          disabled={isSaving || !saveTitle.trim()}
          onClick={() => { void handleSave() }}
          type="button"
        >
          {isSaving ? "Saving…" : "Save Current View"}
        </Button>
        {statusMessage && (
          <div className="text-sm text-muted-foreground">{statusMessage}</div>
        )}

        <div className="grid gap-2">
          {savedViews.length === 0 ? (
            <div className="text-sm text-muted-foreground">No saved views for this room yet.</div>
          ) : (
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
                <div className="mt-1 text-xs text-muted-foreground">
                  {view.nodeCount}n · {view.edgeCount}e · {formatTimestamp(view.updatedAt)}
                </div>
                <div className="mt-2 flex gap-2">
                  <Button onClick={() => { void handleOpen(view.id) }} size="sm" type="button">
                    Open
                  </Button>
                  <Button
                    onClick={() => { void handleCopyLink(view.id) }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Copy Link
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

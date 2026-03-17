"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BoardConnectionType } from "@/features/incident-workspace/lib/board/types"
import { MAP_KIND_LABELS } from "@/features/incident-workspace/components/board/boardShellShared"
import { useBoardEntities } from "@/features/incident-workspace/components/board/BoardEntitiesContext"
import { useBoardSelection } from "@/features/incident-workspace/components/board/BoardSelectionContext"
import { useBoardUI } from "@/features/incident-workspace/components/board/BoardUIContext"

/**
 * EntitySelectionPanel — top-left overlay containing:
 * - Status/presence badge strip
 * - Selected entity card with actions and artifact link controls
 * - Per-connection remove cards
 *
 * Mounted as an absolutely-positioned overlay inside the board canvas stage.
 */
export function EntitySelectionPanel() {
  const {
    connectionDraftCustomLabel,
    connectionDraftType,
    connectionStatus,
    connectionToneMap,
    linkedCaseId,
    onConnectDraftCustomLabelChange,
    onConnectDraftTypeChange,
    onLinkArtifactCancel,
    onLinkArtifactStart,
    pendingConnectionSourceId,
    visibleSeverity,
    visibleStatus,
  } = useBoardUI()

  const {
    onDeleteSelectedEntity,
    onPromoteSelectedEntity,
    promotingSourceId,
    selectedEntity,
    selectedEntityConnections,
    selectedEntityId,
    selectedEntityLabel,
    selectedEntityLinkedActionCount,
    selectedEntityLinkedEntryCount,
    selectedEntityMapKind,
  } = useBoardSelection()

  const {
    connections,
    entities,
    getEntityLabel,
    onCreateActionForEntity,
    onDeleteConnection,
    onLogEntityToFeed,
    onRenameConnectionLabel,
    presence,
  } = useBoardEntities()

  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        top: 16,
        zIndex: 110,
        display: "grid",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {/* Status badge strip */}
      <Card
        style={{
          borderRadius: 16,
          boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
          pointerEvents: "auto",
          maxWidth: "min(880px, calc(100vw - 440px))",
          overflowX: "auto",
          overflowY: "hidden",
        }}
        className="border-border/40 bg-card/90 backdrop-blur"
      >
        <CardContent className="flex items-center gap-2 overflow-x-auto whitespace-nowrap p-2 text-[11px] font-semibold text-muted-foreground">
          <Badge variant={connectionStatus === "connected" ? "success" : "muted"}>
            {connectionStatus}
          </Badge>
          <Badge
            variant={
              visibleStatus === "mitigated"
                ? "success"
                : visibleStatus === "monitoring"
                  ? "warning"
                  : "critical"
            }
          >
            {visibleSeverity.toUpperCase()} · {visibleStatus}
          </Badge>
          <Badge variant="outline">{entities.length} entities</Badge>
          <Badge variant="outline">{presence.length} participants</Badge>
        </CardContent>
      </Card>

      {/* Selected entity card */}
      {selectedEntity && selectedEntityMapKind ? (
        <Card
          style={{
            boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
            pointerEvents: "auto",
            maxWidth: 320,
          }}
          className="border-border/40 bg-card/95 backdrop-blur"
        >
          <CardHeader className="space-y-2 p-3">
            <Badge className="w-fit" variant="outline">
              {MAP_KIND_LABELS[selectedEntityMapKind]}
            </Badge>
            <CardTitle className="text-sm">
              {selectedEntityLabel ?? getEntityLabel(selectedEntity.id)}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="muted">{selectedEntityLinkedEntryCount} linked feed</Badge>
              <Badge variant="muted">{selectedEntityLinkedActionCount} linked actions</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-3 pt-0">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(selectedEntityMapKind === "scope" ||
                selectedEntityMapKind === "handoff" ||
                selectedEntityMapKind === "evidence") ? (
                <Button
                  onClick={() => onLogEntityToFeed(selectedEntity.id)}
                  size="sm"
                  type="button"
                >
                  Log to Feed
                </Button>
              ) : null}
              {(selectedEntityMapKind === "blocker" ||
                selectedEntityMapKind === "hypothesis") ? (
                <Button
                  onClick={() => onCreateActionForEntity(selectedEntity.id)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Create Action
                </Button>
              ) : null}
              {linkedCaseId &&
              (selectedEntity.type === "incidentCard" || selectedEntity.type === "note") ? (
                <Button
                  className="bg-emerald-700 text-white hover:bg-emerald-800"
                  onClick={onPromoteSelectedEntity}
                  disabled={promotingSourceId === selectedEntity.id}
                  size="sm"
                  type="button"
                >
                  {promotingSourceId === selectedEntity.id ? "Promoting..." : "Promote to Case"}
                </Button>
              ) : null}
              <Button
                onClick={onDeleteSelectedEntity}
                size="sm"
                type="button"
                variant="destructive"
              >
                Delete
              </Button>
            </div>

            <div className="grid gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Artifact links
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => onLinkArtifactStart(selectedEntity.id)}
                  size="sm"
                  type="button"
                  variant={pendingConnectionSourceId ? "default" : "outline"}
                >
                  {pendingConnectionSourceId ? "Click target to connect" : "Link Artifact"}
                </Button>
                <Select
                  value={connectionDraftType}
                  onValueChange={(value) =>
                    onConnectDraftTypeChange(value as BoardConnectionType)
                  }
                >
                  <SelectTrigger className="h-9 min-w-[132px] bg-background text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supports">Supports</SelectItem>
                    <SelectItem value="blocks">Blocks</SelectItem>
                    <SelectItem value="mitigates">Mitigates</SelectItem>
                    <SelectItem value="relates_to">Relates to</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {connectionDraftType === "custom" ? (
                  <Input
                    className="h-9 min-w-[160px] text-xs font-semibold"
                    value={connectionDraftCustomLabel}
                    onChange={(event) => onConnectDraftCustomLabelChange(event.target.value)}
                    placeholder="Custom link label"
                  />
                ) : null}
                {pendingConnectionSourceId ? (
                  <Button
                    onClick={onLinkArtifactCancel}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Per-connection remove cards */}
      {selectedEntityConnections.map((connection) => {
        const otherEntityId =
          connection.sourceEntityId === selectedEntityId
            ? connection.targetEntityId
            : connection.sourceEntityId
        const tone = connectionToneMap[connection.type]
        const connectionLabel =
          connection.type === "custom" && connection.customLabel?.trim()
            ? connection.customLabel.trim()
            : tone.label

        return (
          <Card
            key={connection.id}
            style={{
              boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
              pointerEvents: "auto",
              maxWidth: 320,
            }}
            className="border-border/40 bg-card/95"
          >
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div className="text-xs font-semibold text-muted-foreground">
                <span
                  onClick={() => onRenameConnectionLabel(connection.id, connectionLabel)}
                  style={{ color: tone.color, cursor: "pointer" }}
                >
                  {connectionLabel}
                </span>{" "}
                {getEntityLabel(otherEntityId)}
              </div>
              <Button
                onClick={() => onDeleteConnection(connection.id)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Remove
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

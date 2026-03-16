"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { InvestigationSeverity, InvestigationStatus } from "@/lib/contracts/investigations"
import type { ConnectionStatus } from "@/features/incident-workspace/components/board/boardCore"
import type {
  BoardConnection,
  BoardConnectionType,
  BoardEntity,
  PresenceState,
  PresenceUser,
} from "@/features/incident-workspace/lib/board/types"
import { boardToScreen } from "@/features/incident-workspace/components/board/boardCore"
import {
  MAP_KIND_LABELS,
  type PendingMapPrompt,
} from "@/features/incident-workspace/components/board/boardShellShared"
import {
  LiveSessionPanel,
  type ActiveScreenShare,
  type LiveShareView,
} from "@/features/incident-workspace/components/livekit/LiveSessionPanel"
import { type MutableRefObject, type ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type ConnectionToneMap = Record<BoardConnectionType, { color: string; label: string }>

type BoardCanvasProps = {
  activeScreenShares: ActiveScreenShare[]
  activeShareView: LiveShareView
  areZonesEditable: boolean
  camera: { x: number; y: number; zoom: number }
  commandHints: string[]
  connectionDraftCustomLabel: string
  connectionDraftType: BoardConnectionType
  connectionStatus: ConnectionStatus
  connectionToneMap: ConnectionToneMap
  connections: BoardConnection[]
  entities: BoardEntity[]
  fitCanvasToScreen: () => void
  getEntityLabel: (entityId: string) => string
  hasActiveScreenShares: boolean
  isBoardFocused: boolean
  isBoardFullscreen: boolean
  isCanvasVisualMode: boolean
  isHelpOpen: boolean
  isPanning: boolean
  linkedCaseId?: string | null
  onActiveRailPanelOpen: () => void
  onBackgroundPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  onConnectDraftCustomLabelChange: (value: string) => void
  onConnectDraftTypeChange: (value: BoardConnectionType) => void
  onCreateActionForEntity: (entityId: string) => void
  onCreateBlocker: () => void
  onCreateEvidenceNote: () => void
  onCreateHandoff: () => void
  onCreateHypothesis: () => void
  onCreateImpactNote: () => void
  onCreateZone: () => void
  onDeleteConnection: (connectionId: string) => void
  onDeleteSelectedEntity: () => void
  onDismissPendingMapPrompt: () => void
  onLinkArtifactCancel: () => void
  onLinkArtifactStart: (entityId: string) => void
  onLogEntityToFeed: (entityId: string) => void
  onPromoteSelectedEntity: () => void
  onRenameConnectionLabel: (connectionId: string, currentLabel: string) => void
  onToggleBoardFullscreen: () => void
  onToggleHelpOpen: () => void
  onToggleZoneEditing: () => void
  onWheel: (event: React.WheelEvent<HTMLDivElement>) => void
  pendingConnectionSourceId: string | null
  presence: PresenceState[]
  promotingSourceId: string | null
  remainingAssignedTaskCount: number
  renderEntity: (entity: BoardEntity) => ReactNode
  roomId: string
  selectedEntity: BoardEntity | null
  selectedEntityConnections: BoardConnection[]
  selectedEntityId: string | null
  selectedEntityLinkedActionCount: number
  selectedEntityLinkedEntryCount: number
  selectedEntityMapKind: keyof typeof MAP_KIND_LABELS | null
  setActiveScreenShares: (shares: ActiveScreenShare[]) => void
  setActiveShareView: (view: LiveShareView | ((current: LiveShareView) => LiveShareView)) => void
  stageRect: DOMRect | null
  stageRef: MutableRefObject<HTMLDivElement | null>
  user: PresenceUser
  visiblePendingMapPrompt: PendingMapPrompt | null
  visibleSeverity: InvestigationSeverity
  visibleStatus: InvestigationStatus
}

export function BoardCanvas({
  activeScreenShares,
  activeShareView,
  areZonesEditable,
  camera,
  commandHints,
  connectionDraftCustomLabel,
  connectionDraftType,
  connectionStatus,
  connectionToneMap,
  connections,
  entities,
  fitCanvasToScreen,
  getEntityLabel,
  hasActiveScreenShares,
  isBoardFocused,
  isBoardFullscreen,
  isCanvasVisualMode,
  isHelpOpen,
  isPanning,
  linkedCaseId = null,
  onActiveRailPanelOpen,
  onBackgroundPointerDown,
  onConnectDraftCustomLabelChange,
  onConnectDraftTypeChange,
  onCreateActionForEntity,
  onCreateBlocker,
  onCreateEvidenceNote,
  onCreateHandoff,
  onCreateHypothesis,
  onCreateImpactNote,
  onCreateZone,
  onDeleteConnection,
  onDeleteSelectedEntity,
  onDismissPendingMapPrompt,
  onLinkArtifactCancel,
  onLinkArtifactStart,
  onLogEntityToFeed,
  onPromoteSelectedEntity,
  onRenameConnectionLabel,
  onToggleBoardFullscreen,
  onToggleHelpOpen,
  onToggleZoneEditing,
  onWheel,
  pendingConnectionSourceId,
  presence,
  promotingSourceId,
  remainingAssignedTaskCount,
  renderEntity,
  roomId,
  selectedEntity,
  selectedEntityConnections,
  selectedEntityId,
  selectedEntityLinkedActionCount,
  selectedEntityLinkedEntryCount,
  selectedEntityMapKind,
  setActiveScreenShares,
  setActiveShareView,
  stageRect,
  stageRef,
  user,
  visiblePendingMapPrompt,
  visibleSeverity,
  visibleStatus,
}: BoardCanvasProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      {!linkedCaseId ? (
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid rgba(251, 191, 36, 0.28)",
            background:
              "linear-gradient(180deg, rgba(255, 251, 235, 0.96), rgba(254, 243, 199, 0.88))",
            color: "#78350f",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#92400e",
              }}
            >
              Temporary Workspace
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                lineHeight: 1.55,
                fontWeight: 600,
              }}
            >
              This room is not linked to a case yet. Board state, timeline updates,
              findings, datasource saves, and hunt views stay temporary and will not
              be durably persisted.
            </div>
          </div>
          <Link
            href="/cases"
            style={{
              flexShrink: 0,
              alignSelf: "center",
              textDecoration: "none",
              borderRadius: 12,
              background: "#92400e",
              color: "#fffbeb",
              padding: "10px 12px",
              fontSize: 12,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            Create Case
          </Link>
        </div>
      ) : null}
      <div style={{ position: "relative", flex: 1, minHeight: 0, zIndex: 0 }}>
        <div
          ref={stageRef}
          onPointerDownCapture={() => {
            stageRef.current?.focus()
          }}
          tabIndex={0}
          onPointerDown={onBackgroundPointerDown}
          onWheel={onWheel}
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            cursor: isPanning ? "grabbing" : "grab",
            borderRadius: 24,
            border: isCanvasVisualMode
              ? "4px solid hsl(var(--foreground) / 0.92)"
              : isBoardFocused
                ? "1px solid hsl(var(--border) / 0.75)"
                : "1px solid transparent",
            boxSizing: "border-box",
            outline: isCanvasVisualMode ? "3px solid hsl(var(--primary) / 0.65)" : "none",
            outlineOffset: isCanvasVisualMode ? 3 : 0,
            boxShadow: isCanvasVisualMode
              ? "0 0 0 1px hsl(var(--background)), 0 0 28px hsl(var(--primary) / 0.22)"
              : "none",
          }}
        >
          {isCanvasVisualMode ? (
            <div
              style={{
                position: "absolute",
                inset: "0 0 auto 0",
                height: 52,
                zIndex: 22,
                pointerEvents: "none",
                borderBottom: "1px solid hsl(var(--primary) / 0.28)",
                background:
                  "linear-gradient(180deg, hsl(var(--primary) / 0.2) 0%, hsl(var(--primary) / 0.08) 52%, transparent 100%)",
              }}
            />
          ) : null}
          <div
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              zIndex: 100,
              pointerEvents: "none",
              display: "grid",
              justifyItems: "end",
              gap: 8,
            }}
          >
            {remainingAssignedTaskCount > 0 ? (
              <Button
                className="pointer-events-auto h-8 rounded-full px-3 text-[11px] font-semibold tracking-[0.08em] shadow-lg"
                onClick={onActiveRailPanelOpen}
                size="sm"
                type="button"
              >
                {remainingAssignedTaskCount} task
                {remainingAssignedTaskCount === 1 ? "" : "s"}
              </Button>
            ) : null}
            {isCanvasVisualMode ? (
              <Badge className="rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.12em]" variant="info">
                Visual mode
              </Badge>
            ) : null}
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 25,
              pointerEvents: "none",
              borderRadius: 24,
              boxShadow: isCanvasVisualMode
                ? "inset 0 0 0 2px hsl(var(--background)), inset 0 0 0 7px hsl(var(--primary) / 0.12)"
                : isBoardFocused
                  ? "inset 0 0 0 2px hsl(var(--foreground) / 0.22)"
                  : "none",
              transition: "box-shadow 140ms ease",
            }}
          />
          <svg
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              overflow: "visible",
              zIndex: 10,
            }}
          >
            {connections.map((connection) => {
              const sourceEntity = entities.find((entity) => entity.id === connection.sourceEntityId)
              const targetEntity = entities.find((entity) => entity.id === connection.targetEntityId)

              if (!sourceEntity || !targetEntity) {
                return null
              }

              const sourceX = camera.x + (sourceEntity.x + sourceEntity.width / 2) * camera.zoom
              const sourceY = camera.y + (sourceEntity.y + sourceEntity.height / 2) * camera.zoom
              const targetX = camera.x + (targetEntity.x + targetEntity.width / 2) * camera.zoom
              const targetY = camera.y + (targetEntity.y + targetEntity.height / 2) * camera.zoom
              const tone = connectionToneMap[connection.type]

              return (
                <g key={connection.id}>
                  <line
                    x1={sourceX}
                    y1={sourceY}
                    x2={targetX}
                    y2={targetY}
                    stroke={tone.color}
                    strokeDasharray={connection.type === "relates_to" ? "8 6" : undefined}
                    strokeWidth={3}
                    opacity={0.9}
                  />
                </g>
              )
            })}
          </svg>

          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at top left, hsl(var(--background) / 0.92), hsl(var(--card) / 0.58) 42%, hsl(var(--muted) / 0.34))",
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
              transformOrigin: "top left",
              zIndex: 20,
            }}
          >
            {entities.map(renderEntity)}
          </div>

          <svg
            style={{
              position: "absolute",
              inset: 0,
              overflow: "visible",
              zIndex: 15,
            }}
          >
            {connections.map((connection) => {
              const sourceEntity = entities.find((entity) => entity.id === connection.sourceEntityId)
              const targetEntity = entities.find((entity) => entity.id === connection.targetEntityId)

              if (!sourceEntity || !targetEntity) {
                return null
              }

              const sourceX = camera.x + (sourceEntity.x + sourceEntity.width / 2) * camera.zoom
              const sourceY = camera.y + (sourceEntity.y + sourceEntity.height / 2) * camera.zoom
              const targetX = camera.x + (targetEntity.x + targetEntity.width / 2) * camera.zoom
              const targetY = camera.y + (targetEntity.y + targetEntity.height / 2) * camera.zoom
              const midX = (sourceX + targetX) / 2
              const midY = (sourceY + targetY) / 2
              const tone = connectionToneMap[connection.type]
              const connectionLabel =
                connection.type === "custom" && connection.customLabel?.trim()
                  ? connection.customLabel.trim()
                  : tone.label
              const labelWidth = Math.max(68, Math.min(connectionLabel.length * 7 + 20, 160))

              return (
                <g key={`label-${connection.id}`}>
                  <rect
                    x={midX - labelWidth / 2}
                    y={midY - 11}
                    width={labelWidth}
                    height={22}
                    rx={11}
                    fill="hsl(var(--background) / 0.96)"
                    stroke={tone.color}
                    strokeWidth={1}
                    style={{ cursor: "pointer" }}
                    onClick={(event) => {
                      event.stopPropagation()
                      onRenameConnectionLabel(connection.id, connectionLabel)
                    }}
                  />
                  <text
                    x={midX}
                    y={midY + 4}
                    fill={tone.color}
                    fontSize="11"
                    fontWeight="700"
                    textAnchor="middle"
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={(event) => {
                      event.stopPropagation()
                      onRenameConnectionLabel(connection.id, connectionLabel)
                    }}
                  >
                    {connectionLabel}
                  </text>
                </g>
              )
            })}
          </svg>

        </div>

        {stageRect && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              pointerEvents: "none",
              zIndex: 40,
              borderRadius: 24,
            }}
          >
            {presence
              .filter((item) => item.cursor !== null)
              .map((item) => {
                if (!item.cursor) {
                  return null
                }

                const point = boardToScreen(item.cursor, stageRect, camera)

                return (
                  <div
                    key={item.user.id}
                    style={{
                      position: "absolute",
                      left: point.x - stageRect.left,
                      top: point.y - stageRect.top,
                    }}
                  >
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 999,
                        background: item.user.color,
                        boxShadow: "0 0 0 3px hsl(var(--background) / 0.9)",
                      }}
                    />
                    <div
                      style={{
                        marginTop: 8,
                        marginLeft: 10,
                        padding: "6px 8px",
                        borderRadius: 10,
                        background: "hsl(var(--foreground))",
                        color: "hsl(var(--background))",
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.user.name}
                    </div>
                  </div>
                )
              })}
          </div>
        )}

        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 16,
            transform: "translateX(-50%)",
            pointerEvents: "none",
            width: "min(920px, calc(100% - 380px))",
            display: "flex",
            justifyContent: "center",
            zIndex: 110,
          }}
        >
          <Card
            className="relative border-border/50 bg-card/92 shadow-xl backdrop-blur"
            style={{ pointerEvents: "auto" }}
          >
            <CardContent className="flex items-center gap-2 p-2">
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "nowrap",
                justifyContent: "center",
              }}
            >
              {[
                {
                  accent: "#7c3aed",
                  hotkey: "Q",
                  label: "Hypothesis",
                  onClick: onCreateHypothesis,
                },
                {
                  accent: "#2563eb",
                  hotkey: "W",
                  label: "Impact",
                  onClick: onCreateImpactNote,
                },
                {
                  accent: "#16a34a",
                  hotkey: "E",
                  label: "Evidence",
                  onClick: onCreateEvidenceNote,
                },
                {
                  accent: "#dc2626",
                  hotkey: "R",
                  label: "Blocker",
                  onClick: onCreateBlocker,
                },
                {
                  accent: "#d97706",
                  hotkey: "T",
                  label: "Handoff",
                  onClick: onCreateHandoff,
                },
                {
                  accent: "hsl(var(--muted-foreground))",
                  hotkey: "Y",
                  label: "Zone",
                  onClick: onCreateZone,
                },
              ].map((card) => (
                <Button
                  key={card.label}
                  className="relative h-auto w-[118px] min-w-[118px] rounded-2xl border-border/40 bg-background/92 px-3 py-3 text-left shadow-md"
                  onClick={card.onClick}
                  type="button"
                  variant="outline"
                >
                  <span
                    className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
                    style={{ background: card.accent }}
                  />
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-extrabold text-foreground">
                        {card.label}
                      </span>
                      <Badge
                        className="bg-background/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]"
                        style={{ color: card.accent, borderColor: card.accent }}
                        variant="outline"
                      >
                        {card.hotkey}
                      </Badge>
                    </div>
                    <div className="text-[11px] font-medium text-muted-foreground">
                    Add {card.label.toLowerCase()}
                    </div>
                  </div>
                </Button>
              ))}
              <Button
                className="h-auto w-[118px] min-w-[118px] rounded-2xl px-3 py-3 text-left shadow-md"
                onClick={onToggleZoneEditing}
                type="button"
                variant={areZonesEditable ? "default" : "outline"}
              >
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-extrabold">
                    {areZonesEditable ? "Lock Zones" : "Edit Zones"}
                    </span>
                    <Badge variant={areZonesEditable ? "secondary" : "muted"}>D</Badge>
                  </div>
                  <div className={cn("text-[11px] font-medium", areZonesEditable ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {areZonesEditable ? "Lock zone layout" : "Edit zone layout"}
                  </div>
                </div>
              </Button>
            </div>
            </CardContent>
          </Card>
        </div>

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
              <Badge variant="outline">{activeScreenShares.length} live shares</Badge>
            </CardContent>
          </Card>
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
                <CardTitle className="text-sm">{getEntityLabel(selectedEntity.id)}</CardTitle>
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
                      {promotingSourceId === selectedEntity.id
                        ? "Promoting..."
                        : "Promote to Case"}
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
                        onChange={(event) =>
                          onConnectDraftCustomLabelChange(event.target.value)
                        }
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

        {visiblePendingMapPrompt ? (
          <Card
            style={{
              position: "absolute",
              right: 16,
              top: 16,
              boxShadow: "0 18px 48px rgba(15, 23, 42, 0.18)",
              maxWidth: 320,
            }}
            className="border-border/60 bg-card/95 backdrop-blur"
          >
            <CardHeader className="space-y-2 p-4">
              <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                Next step
              </CardDescription>
              <CardTitle className="text-sm">{getEntityLabel(visiblePendingMapPrompt.entityId)}</CardTitle>
              <CardDescription className="leading-5">
                {visiblePendingMapPrompt.recommendedAction === "feed"
                  ? "This artifact usually needs a shared incident update."
                  : "This artifact usually needs owned follow-up work."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 p-4 pt-0">
              <Button
                onClick={() =>
                  visiblePendingMapPrompt.recommendedAction === "feed"
                    ? onLogEntityToFeed(visiblePendingMapPrompt.entityId)
                    : onCreateActionForEntity(visiblePendingMapPrompt.entityId)
                }
                size="sm"
                type="button"
              >
                {visiblePendingMapPrompt.recommendedAction === "feed"
                  ? "Log to Feed"
                  : "Create Action"}
              </Button>
              <Button
                onClick={onDismissPendingMapPrompt}
                size="sm"
                type="button"
                variant="ghost"
              >
                Dismiss
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div
          style={{
            position: "absolute",
            right: 16,
            bottom: 16,
            pointerEvents: "none",
            zIndex: 110,
          }}
        >
          <div
            style={{
              position: "relative",
              pointerEvents: "auto",
              display: "grid",
              justifyItems: "end",
              gap: 6,
            }}
          >
            {hasActiveScreenShares ? (
              <Card className="w-[220px] border-border/60 bg-card/92 shadow-xl backdrop-blur">
                <CardContent className="grid gap-2 p-2">
                <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Live viewer
                </div>
                <Button
                  className="h-9 justify-between rounded-xl"
                  onClick={() =>
                    setActiveShareView((current) =>
                      current.mode === "gallery" ? { mode: "none" } : { mode: "gallery" },
                    )
                  }
                  size="sm"
                  type="button"
                  variant={activeShareView.mode === "gallery" ? "default" : "secondary"}
                >
                  <span>0 Gallery</span>
                  <span style={{ color: "inherit", opacity: 0.72 }}>
                    {activeScreenShares.length}
                  </span>
                </Button>
                {activeScreenShares.slice(0, 9).map((share, index) => {
                  const isActive =
                    activeShareView.mode === "focused" &&
                    activeShareView.trackId === share.trackId

                  return (
                    <Button
                      key={share.trackId}
                      className="h-9 justify-between gap-2 rounded-xl"
                      onClick={() =>
                        setActiveShareView((current) =>
                          current.mode === "focused" && current.trackId === share.trackId
                            ? { mode: "none" }
                            : {
                                mode: "focused",
                                openedFromGallery: true,
                                trackId: share.trackId,
                              },
                        )
                      }
                      size="sm"
                      type="button"
                      variant={isActive ? "default" : "secondary"}
                    >
                      <span>{index + 1}</span>
                      <span
                        style={{
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          textAlign: "left",
                        }}
                      >
                        {share.participantName}
                      </span>
                    </Button>
                  )
                })}
                </CardContent>
              </Card>
            ) : null}
            <Card className="min-w-[156px] border-border/50 bg-card/92 shadow-xl backdrop-blur">
              <CardContent className="flex flex-col gap-2 p-2">
              <LiveSessionPanel
                activeShareView={activeShareView}
                inlineTrigger
                isViewerEnabled
                onActiveShareViewChange={setActiveShareView}
                onScreenSharesChange={setActiveScreenShares}
                roomId={roomId}
                user={user}
              />
              <Button
                className="justify-start rounded-xl"
                onClick={fitCanvasToScreen}
                size="sm"
                type="button"
              >
                Fit To Screen
              </Button>
              <Button
                className="justify-start rounded-xl"
                onClick={onToggleBoardFullscreen}
                size="sm"
                type="button"
                variant={isBoardFullscreen ? "default" : "secondary"}
              >
                {isBoardFullscreen ? "Show Workspace" : "Focus Board"}
              </Button>
              <Button asChild className="justify-start rounded-xl" size="sm" type="button">
                <Link href={`/hunt/${roomId}`} target="_blank" rel="noopener noreferrer">Open Hunt Graph</Link>
              </Button>
              <Button
                className="justify-start rounded-xl"
                onClick={onToggleHelpOpen}
                size="sm"
                type="button"
                variant="secondary"
              >
                {isHelpOpen ? "Hide Shortcuts" : "Show Shortcuts"}
              </Button>
              </CardContent>
            </Card>

            {isHelpOpen ? (
              <Card
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: "calc(100% + 10px)",
                  width: "min(440px, calc(100vw - 48px))",
                  maxHeight: "min(420px, calc(100vh - 120px))",
                  boxShadow: "0 18px 48px rgba(15, 23, 42, 0.18)",
                  overflow: "auto",
                }}
                className="border-border/60 bg-card/96 backdrop-blur"
              >
                <CardHeader className="p-4 pb-2">
                  <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                    Board Commands
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2 p-4 pt-0">
                  {commandHints.map((hint) => (
                    <Card
                      key={hint}
                      className="border-border/40 bg-background/80 shadow-none"
                    >
                      <CardContent className="flex min-h-10 items-center p-3 text-sm font-medium">
                        {hint}
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

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
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  MAP_KIND_LABELS,
  ZONE_COLOR_SWATCHES,
  getEntityMapKind,
} from "@/features/incident-workspace/components/board/boardShellShared"
import type {
  BoardEntity,
  IncidentActionStatus,
  IncidentCardEntity,
  IncidentLogEntry,
  InvestigationZoneEntity,
  NoteEntity,
  ScreenTileEntity,
  StatusMarkerEntity,
} from "@/features/incident-workspace/lib/board/types"
import { cn } from "@/lib/utils"
import type { PointerEvent as ReactPointerEvent, RefObject } from "react"

type EntityPointerTarget = HTMLElement | HTMLDivElement | HTMLButtonElement

type BadgeVariant = "critical" | "info" | "muted" | "secondary" | "success" | "warning"

type SurfaceTone = {
  accent: string
  badgeVariant: BadgeVariant
  tint: string
}

type ResizeStart = {
  entityId: string
  originHeight: number
  originWidth: number
  pointerId: number
  startClientX: number
  startClientY: number
}

type BoardEntityRendererProps = {
  areZonesEditable: boolean
  entity: BoardEntity
  incidentActions: Array<{
    id: string
    linkedEntityIds: string[]
    owner: string
    sourceLogEntryId: string | null
    status: IncidentActionStatus
    title: string
  }>
  incidentLog: IncidentLogEntry[]
  onBeginEntityDrag: (event: ReactPointerEvent<EntityPointerTarget>, entityId: string) => void
  onConnectToEntity: (entityId: string) => void
  onFocusEntityOnCanvas: (entityId: string) => void
  onPrimarySelectionChange: (entityId: string | null) => void
  onResizeStart: (input: ResizeStart) => void
  onSelectSingleEntity: (entityId: string) => void
  onSetCanvasVisualMode: (next: boolean) => void
  onShiftLinkToEntity: (entityId: string) => boolean
  onToggleEntitySelection: (entityId: string) => void
  pendingConnectionSourceId: string | null
  remoteSelectionColor?: string
  selectedEntityIds: string[]
  stageRef: RefObject<HTMLDivElement | null>
  updateEntity: (entityId: string, updater: (entity: BoardEntity) => BoardEntity) => void
}

const MAP_KIND_BADGE_TONE = {
  blocker: "critical",
  evidence: "success",
  handoff: "warning",
  hypothesis: "secondary",
  scope: "info",
} as const

const MAP_SURFACE_TONES: Record<
  keyof typeof MAP_KIND_BADGE_TONE,
  SurfaceTone
> = {
  blocker: {
    accent: "#dc2626",
    badgeVariant: "critical",
    tint: "rgba(220, 38, 38, 0.18)",
  },
  evidence: {
    accent: "#16a34a",
    badgeVariant: "success",
    tint: "rgba(22, 163, 74, 0.18)",
  },
  handoff: {
    accent: "#d97706",
    badgeVariant: "warning",
    tint: "rgba(217, 119, 6, 0.18)",
  },
  hypothesis: {
    accent: "#7c3aed",
    badgeVariant: "secondary",
    tint: "rgba(124, 58, 237, 0.18)",
  },
  scope: {
    accent: "#2563eb",
    badgeVariant: "info",
    tint: "rgba(37, 99, 235, 0.18)",
  },
}

function getNoteSurfaceTone(entity: NoteEntity): SurfaceTone {
  if (entity.mapKind) {
    return MAP_SURFACE_TONES[entity.mapKind]
  }

  return {
    accent: entity.color,
    badgeVariant: "muted",
    tint: entity.color,
  }
}

function getIncidentSurfaceTone(entity: IncidentCardEntity): SurfaceTone {
  if (entity.mapKind === "scope") {
    return MAP_SURFACE_TONES.scope
  }

  switch (entity.severity) {
    case "critical":
      return {
        accent: "#b91c1c",
        badgeVariant: "critical",
        tint: "rgba(185, 28, 28, 0.16)",
      }
    case "high":
      return {
        accent: "#dc2626",
        badgeVariant: "critical",
        tint: "rgba(220, 38, 38, 0.12)",
      }
    case "medium":
      return {
        accent: "#d97706",
        badgeVariant: "warning",
        tint: "rgba(217, 119, 6, 0.14)",
      }
    case "low":
    default:
      return {
        accent: "#2563eb",
        badgeVariant: "info",
        tint: "rgba(37, 99, 235, 0.12)",
      }
  }
}

export function BoardEntityRenderer({
  areZonesEditable,
  entity,
  incidentActions,
  incidentLog,
  onBeginEntityDrag,
  onConnectToEntity,
  onFocusEntityOnCanvas,
  onPrimarySelectionChange,
  onResizeStart,
  onSelectSingleEntity,
  onSetCanvasVisualMode,
  onShiftLinkToEntity,
  onToggleEntitySelection,
  pendingConnectionSourceId,
  remoteSelectionColor,
  selectedEntityIds,
  stageRef,
  updateEntity,
}: BoardEntityRendererProps) {
  const isSelected = selectedEntityIds.includes(entity.id)
  const linkedEntryCount = incidentLog.filter((entry) =>
    entry.linkedEntityIds.includes(entity.id),
  ).length
  const linkedActionCount = incidentActions.filter((action) =>
    action.linkedEntityIds.includes(entity.id),
  ).length
  const mapKind = getEntityMapKind(entity)
  const isZoneLocked = entity.type === "investigationZone" && !areZonesEditable

  const shellStyle = {
    position: "absolute",
    left: entity.x,
    top: entity.y,
    width: entity.width,
    height: entity.height,
    zIndex:
      entity.type === "investigationZone"
        ? Math.min(entity.zIndex, -1000)
        : Math.max(entity.zIndex, 1),
    boxShadow: isSelected
      ? "0 0 0 2px hsl(var(--ring) / 0.75), 0 12px 28px rgba(15, 23, 42, 0.12)"
      : remoteSelectionColor
        ? `0 0 0 2px ${remoteSelectionColor}, 0 12px 28px rgba(15, 23, 42, 0.12)`
        : "0 12px 30px rgba(15, 23, 42, 0.08)",
    userSelect: "none",
  } as const

  const handleEntitySelection = (event?: ReactPointerEvent<EntityPointerTarget>) => {
    if (pendingConnectionSourceId && pendingConnectionSourceId !== entity.id) {
      onConnectToEntity(entity.id)
      return true
    }

    if (event?.shiftKey && onShiftLinkToEntity(entity.id)) {
      return true
    }

    if (event && (event.ctrlKey || event.metaKey)) {
      onToggleEntitySelection(entity.id)
      return true
    }

    onSelectSingleEntity(entity.id)
    return false
  }

  const handleEntityDoubleClick = () => {
    onSelectSingleEntity(entity.id)
    onFocusEntityOnCanvas(entity.id)
    onSetCanvasVisualMode(false)

    window.requestAnimationFrame(() => {
      const selectedElement = stageRef.current?.querySelector<HTMLElement>(
        `[data-entity-id="${entity.id}"] input, [data-entity-id="${entity.id}"] textarea, [data-entity-id="${entity.id}"] select`,
      )

      selectedElement?.focus()
    })
  }

  const handleEntityDragStart = (event: ReactPointerEvent<EntityPointerTarget>) => {
    event.stopPropagation()
    const isModifierSelection = event.ctrlKey || event.metaKey
    const isDraggingExistingGroup =
      !isModifierSelection &&
      selectedEntityIds.length > 1 &&
      selectedEntityIds.includes(entity.id)

    if (isDraggingExistingGroup) {
      onPrimarySelectionChange(entity.id)
    } else {
      const selectionHandled = handleEntitySelection(event)

      if (selectionHandled || event.shiftKey) {
        return
      }
    }

    if (pendingConnectionSourceId || isModifierSelection) {
      return
    }

    onBeginEntityDrag(event, entity.id)
  }

  const evidenceUrl =
    entity.type === "note" && entity.mapKind === "evidence"
      ? entity.sourceLabel?.trim() ?? ""
      : ""
  const hasEvidenceUrl = evidenceUrl.startsWith("https://") || evidenceUrl.startsWith("http://")
  const noteSurfaceTone = entity.type === "note" ? getNoteSurfaceTone(entity) : null
  const incidentSurfaceTone = entity.type === "incidentCard" ? getIncidentSurfaceTone(entity) : null

  const resizeHandle =
    entity.type === "statusMarker" || isZoneLocked ? null : (
      <Button
        aria-label="Resize entity"
        className="absolute bottom-2.5 right-2.5 size-5 cursor-nwse-resize rounded-full border border-border/60 bg-background/80 p-0 text-transparent shadow-sm hover:bg-accent"
        onPointerDown={(event) => {
          event.stopPropagation()
          onResizeStart({
            entityId: entity.id,
            originHeight: entity.height,
            originWidth: entity.width,
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
          })
        }}
        size="icon"
        type="button"
        variant="ghost"
      >
        resize
      </Button>
    )

  const metaBadges = mapKind ? (
    <div className="mb-3 flex flex-wrap gap-2">
      <Badge variant={MAP_KIND_BADGE_TONE[mapKind]}>{MAP_KIND_LABELS[mapKind]}</Badge>
      {linkedEntryCount > 0 ? <Badge variant="muted">{linkedEntryCount} feed</Badge> : null}
      {linkedActionCount > 0 ? <Badge variant="info">{linkedActionCount} actions</Badge> : null}
    </div>
  ) : null

  if (entity.type === "investigationZone") {
    return (
      <Card
        key={entity.id}
        className={cn(
          "overflow-hidden rounded-2xl border-dashed bg-card shadow-none",
          isZoneLocked ? "pointer-events-none" : "pointer-events-auto",
        )}
        data-entity-id={entity.id}
        onDoubleClick={handleEntityDoubleClick}
        onPointerDown={isZoneLocked ? undefined : handleEntityDragStart}
        style={{
          ...shellStyle,
          backgroundColor: "var(--card)",
          borderColor: "var(--border)",
          boxShadow: isSelected
            ? "0 0 0 2px hsl(var(--ring) / 0.72), inset 0 0 0 1px hsl(var(--background) / 0.55)"
            : "inset 0 0 0 1px rgba(255, 255, 255, 0.5)",
        }}
      >
        {isZoneLocked ? (
          <CardContent className="flex items-start justify-start p-4">
            <Badge className="rounded-full bg-background px-3 py-1.5 text-[11px] uppercase tracking-[0.12em]" variant="outline">
              {entity.title}
            </Badge>
          </CardContent>
        ) : (
          <CardContent className="space-y-3 p-4 pb-10 pr-10 pt-4">
            <Badge className="rounded-full text-[11px] uppercase tracking-[0.14em]" variant="muted">
              Zone
            </Badge>
            <Input
              className="h-auto border-0 bg-transparent px-0 text-lg font-bold text-foreground shadow-none focus-visible:ring-0"
              onChange={(event) => {
                updateEntity(entity.id, (current) => ({
                  ...current,
                  title: event.target.value,
                  updatedAt: Date.now(),
                }) as InvestigationZoneEntity)
              }}
              onPointerDown={(event) => {
                event.stopPropagation()
                onSelectSingleEntity(entity.id)
              }}
              value={entity.title}
            />
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Zone color
              </div>
              <div className="flex flex-wrap gap-2">
                {ZONE_COLOR_SWATCHES.map((swatch) => {
                  const isActive = entity.color === swatch

                  return (
                    <Button
                      key={swatch}
                      className={cn(
                        "size-5 rounded-full border p-0 shadow-none transition-transform hover:scale-105",
                        isActive ? "border-foreground ring-2 ring-ring/30" : "border-border/40",
                      )}
                      onClick={(event) => {
                        event.stopPropagation()
                        updateEntity(entity.id, (current) => ({
                          ...current,
                          color: swatch,
                          updatedAt: Date.now(),
                        }) as InvestigationZoneEntity)
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      style={{ background: swatch }}
                      type="button"
                      variant="ghost"
                    />
                  )
                })}
              </div>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Drag, resize, and rename this zone to structure the board your way.
            </p>
          </CardContent>
        )}
        {resizeHandle}
      </Card>
    )
  }

  if (entity.type === "note") {
    return (
      <Card
        key={entity.id}
        className="overflow-hidden rounded-2xl border-border/50 bg-card"
        data-entity-id={entity.id}
        onDoubleClick={handleEntityDoubleClick}
        onPointerDown={handleEntityDragStart}
        onPointerDownCapture={(event) => {
          if (pendingConnectionSourceId && pendingConnectionSourceId !== entity.id) {
            event.stopPropagation()
            onConnectToEntity(entity.id)
          }
        }}
        style={{
          ...shellStyle,
          backgroundColor: "var(--card)",
          borderColor: noteSurfaceTone?.accent ?? "var(--border)",
        }}
      >
        {noteSurfaceTone ? (
          <div
            className="absolute inset-x-0 top-0 h-1.5"
            style={{ background: noteSurfaceTone.accent }}
          />
        ) : null}
        <div className="flex h-full min-h-0 flex-col">
          <CardHeader className="gap-3 px-4 pb-2 pr-10 pt-4">
            {metaBadges}
            <CardTitle>
              <Input
                className="h-auto border-0 bg-transparent px-0 text-xl font-bold text-foreground shadow-none focus-visible:ring-0"
                onChange={(event) => {
                  updateEntity(entity.id, (current) => ({
                    ...current,
                    title: event.target.value,
                    updatedAt: Date.now(),
                  }) as NoteEntity)
                }}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  onSelectSingleEntity(entity.id)
                }}
                value={entity.title}
              />
            </CardTitle>

            {entity.mapKind === "hypothesis" ? (
              <div className="flex flex-wrap gap-2">
                <Select
                  onValueChange={(value) => {
                    updateEntity(entity.id, (current) => ({
                      ...current,
                      state: value as NoteEntity["state"],
                      updatedAt: Date.now(),
                    }) as NoteEntity)
                  }}
                  value={entity.state ?? "new"}
                >
                  <SelectTrigger
                    className="h-9 rounded-full bg-background text-xs font-semibold"
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="testing">Testing</SelectItem>
                    <SelectItem value="supported">Supported</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="h-9 min-w-[140px] flex-1 rounded-full bg-background"
                  onChange={(event) => {
                    updateEntity(entity.id, (current) => ({
                      ...current,
                      owner: event.target.value,
                      updatedAt: Date.now(),
                    }) as NoteEntity)
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  placeholder="Owner"
                  value={entity.owner ?? ""}
                />
              </div>
            ) : null}

            {entity.mapKind === "evidence" ? (
              <div className="grid gap-2">
                <Input
                  className="bg-background"
                  onChange={(event) => {
                    updateEntity(entity.id, (current) => ({
                      ...current,
                      sourceLabel: event.target.value,
                      updatedAt: Date.now(),
                    }) as NoteEntity)
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  placeholder="Source or deep link"
                  value={entity.sourceLabel ?? ""}
                />
                {hasEvidenceUrl ? (
                  <Button
                    className="justify-self-start"
                    onClick={(event) => {
                      event.stopPropagation()
                      window.open(evidenceUrl, "_blank", "noopener,noreferrer")
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Open source
                  </Button>
                ) : null}
              </div>
            ) : null}

            {(entity.mapKind === "blocker" || entity.mapKind === "handoff") ? (
              <Input
                className="bg-background"
                onChange={(event) => {
                  updateEntity(entity.id, (current) => ({
                    ...current,
                    owner: event.target.value,
                    updatedAt: Date.now(),
                  }) as NoteEntity)
                }}
                onPointerDown={(event) => event.stopPropagation()}
                placeholder="Owner"
                value={entity.owner ?? ""}
              />
            ) : null}
          </CardHeader>
          <Separator />
          <CardContent className="flex min-h-0 flex-1 flex-col gap-1.5 px-4 pb-10 pr-10 pt-3">
            <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.14em]">
              Details
            </CardDescription>
            <Textarea
              className="min-h-0 flex-1 resize-none bg-background leading-6"
              onChange={(event) => {
                updateEntity(entity.id, (current) => ({
                  ...current,
                  body: event.target.value,
                  updatedAt: Date.now(),
                }) as NoteEntity)
              }}
              onPointerDown={(event) => {
                event.stopPropagation()
                onSelectSingleEntity(entity.id)
              }}
              value={entity.body}
            />
          </CardContent>
        </div>
        {resizeHandle}
      </Card>
    )
  }

  if (entity.type === "incidentCard") {
    return (
      <Card
        key={entity.id}
        className="overflow-hidden rounded-2xl border-border bg-card"
        data-entity-id={entity.id}
        onDoubleClick={handleEntityDoubleClick}
        onPointerDown={handleEntityDragStart}
        onPointerDownCapture={(event) => {
          if (pendingConnectionSourceId && pendingConnectionSourceId !== entity.id) {
            event.stopPropagation()
            onConnectToEntity(entity.id)
          }
        }}
        style={{
          ...shellStyle,
          backgroundColor: "var(--card)",
          borderColor: incidentSurfaceTone?.accent ?? "var(--border)",
        }}
      >
        {incidentSurfaceTone ? (
          <div
            className="absolute inset-x-0 top-0 h-1.5"
            style={{ background: incidentSurfaceTone.accent }}
          />
        ) : null}
        <div className="flex h-full min-h-0 flex-col">
          <CardHeader className="gap-3 px-5 pb-2 pr-10 pt-4">
            {metaBadges}
            <div className="flex flex-wrap items-center gap-2">
              <Select
                onValueChange={(value) => {
                  updateEntity(entity.id, (current) => ({
                    ...current,
                    severity: value as IncidentCardEntity["severity"],
                    updatedAt: Date.now(),
                  }) as IncidentCardEntity)
                }}
                value={entity.severity}
              >
                <SelectTrigger
                  className="h-9 rounded-full bg-background text-xs font-semibold"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Select
                onValueChange={(value) => {
                  updateEntity(entity.id, (current) => ({
                    ...current,
                    status: value as IncidentCardEntity["status"],
                    updatedAt: Date.now(),
                  }) as IncidentCardEntity)
                }}
                value={entity.status}
              >
                <SelectTrigger
                  className="h-9 rounded-full bg-background text-xs font-semibold"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="monitoring">Monitoring</SelectItem>
                  <SelectItem value="mitigated">Mitigated</SelectItem>
                </SelectContent>
              </Select>
              {entity.mapKind === "scope" ? (
                <Select
                  onValueChange={(value) => {
                    updateEntity(entity.id, (current) => ({
                      ...current,
                      scopeType: value as IncidentCardEntity["scopeType"],
                      updatedAt: Date.now(),
                    }) as IncidentCardEntity)
                  }}
                  value={entity.scopeType ?? "service"}
                >
                  <SelectTrigger
                    className="h-9 rounded-full bg-background text-xs font-semibold"
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="host">Host</SelectItem>
                    <SelectItem value="identity">Identity</SelectItem>
                    <SelectItem value="tenant">Tenant</SelectItem>
                    <SelectItem value="detection">Detection</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
            </div>

            <CardTitle>
              <Input
                className="h-auto border-0 bg-transparent px-0 text-xl font-bold text-foreground shadow-none focus-visible:ring-0"
                onChange={(event) => {
                  updateEntity(entity.id, (current) => ({
                    ...current,
                    title: event.target.value,
                    updatedAt: Date.now(),
                  }) as IncidentCardEntity)
                }}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  onSelectSingleEntity(entity.id)
                }}
                value={entity.title}
              />
            </CardTitle>
            <Input
              className="bg-background"
              onChange={(event) => {
                updateEntity(entity.id, (current) => ({
                  ...current,
                  owner: event.target.value,
                  updatedAt: Date.now(),
                }) as IncidentCardEntity)
              }}
              onPointerDown={(event) => event.stopPropagation()}
              placeholder="Owner"
              value={entity.owner ?? ""}
            />
          </CardHeader>
          <Separator />
          <CardContent className="flex min-h-0 flex-1 flex-col gap-1.5 px-5 pb-10 pr-10 pt-3">
            <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.14em]">
              Impact details
            </CardDescription>
            <Textarea
              className="min-h-0 flex-1 resize-none bg-background leading-6"
              onChange={(event) => {
                updateEntity(entity.id, (current) => ({
                  ...current,
                  body: event.target.value,
                  updatedAt: Date.now(),
                }) as IncidentCardEntity)
              }}
              onPointerDown={(event) => {
                event.stopPropagation()
                onSelectSingleEntity(entity.id)
              }}
              value={entity.body}
            />
          </CardContent>
        </div>
        {resizeHandle}
      </Card>
    )
  }

  if (entity.type === "statusMarker") {
    const toneClass: Record<StatusMarkerEntity["tone"], string> = {
      danger: "border-destructive/20 bg-card",
      neutral: "border-border bg-card",
      success: "border-success/20 bg-card",
      warn: "border-warning/20 bg-card",
    }
    const toneBadgeVariant: Record<StatusMarkerEntity["tone"], BadgeVariant> = {
      danger: "critical",
      neutral: "muted",
      success: "success",
      warn: "warning",
    }

    return (
      <Card
        key={entity.id}
        className={cn(
          "rounded-2xl shadow-sm",
          toneClass[entity.tone],
        )}
        data-entity-id={entity.id}
        onDoubleClick={handleEntityDoubleClick}
        onPointerDown={handleEntityDragStart}
        style={{ ...shellStyle, height: 52 }}
      >
        <CardContent className="flex h-full items-center justify-between gap-3 px-4 py-0">
          <CardTitle className="text-sm font-bold">{entity.label}</CardTitle>
          <Badge variant={toneBadgeVariant[entity.tone]}>{entity.tone}</Badge>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      key={entity.id}
      className="overflow-hidden rounded-2xl border-border bg-background"
      data-entity-id={entity.id}
      onDoubleClick={handleEntityDoubleClick}
      onPointerDown={handleEntityDragStart}
      onPointerDownCapture={(event) => {
        if (pendingConnectionSourceId && pendingConnectionSourceId !== entity.id) {
          event.stopPropagation()
          onConnectToEntity(entity.id)
        }
      }}
      style={{
        ...shellStyle,
        backgroundColor: "var(--card)",
        borderColor: entity.status === "active" ? "#2563eb" : "var(--border)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ background: entity.status === "active" ? "#2563eb" : "var(--border)" }}
      />
      <div className="flex h-full min-h-0 flex-col">
        <CardHeader className="px-4 pb-3 pr-10 pt-4">
          <CardTitle>
            <Input
              className="h-auto border-0 bg-transparent px-0 text-xl font-bold text-foreground shadow-none focus-visible:ring-0"
              onChange={(event) => {
                updateEntity(entity.id, (current) => ({
                  ...current,
                  title: event.target.value,
                  updatedAt: Date.now(),
                }) as ScreenTileEntity)
              }}
              onPointerDown={(event) => {
                event.stopPropagation()
                onSelectSingleEntity(entity.id)
              }}
              value={entity.title}
            />
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="px-4 pb-10 pr-10 pt-4">
          <Card className="mt-0 grid place-items-center rounded-2xl border border-dashed border-border/60 bg-muted shadow-none">
            <CardContent
              className="grid place-items-center p-4 text-center text-sm text-muted-foreground"
              style={{ height: entity.height - 112 }}
            >
              {entity.status === "active"
                ? "Live screen share connected."
                : "Waiting for a shared screen."}
            </CardContent>
          </Card>
        </CardContent>
      </div>
      {resizeHandle}
    </Card>
  )
}

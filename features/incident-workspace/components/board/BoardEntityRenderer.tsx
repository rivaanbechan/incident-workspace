"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  MAP_KIND_LABELS,
  getEntityMapKind,
} from "@/features/incident-workspace/components/board/boardShellShared"
import { useBoardEntities } from "@/features/incident-workspace/components/board/BoardEntitiesContext"
import { useBoardSelection } from "@/features/incident-workspace/components/board/BoardSelectionContext"
import { useBoardUI } from "@/features/incident-workspace/components/board/BoardUIContext"
import type {
  BoardEntity,
  IncidentCardEntity,
  NoteEntity,
} from "@/features/incident-workspace/lib/board/types"
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from "react"
import { ReasoningEntityCard } from "@/features/agents/components/ReasoningEntityCard"
import { IncidentEntityCard } from "./IncidentEntityCard"
import { NoteEntityCard } from "./NoteEntityCard"
import { ScreenTileEntityCard } from "./ScreenTileEntityCard"
import { StatusMarkerEntityCard } from "./StatusMarkerEntityCard"
import { ZoneEntityCard } from "./ZoneEntityCard"

export type EntityPointerTarget = HTMLElement | HTMLDivElement | HTMLButtonElement

type BadgeVariant = "critical" | "info" | "muted" | "secondary" | "success" | "warning"

export type SurfaceTone = {
  accent: string
  tint: string
}

export type ResizeStart = {
  entityId: string
  originHeight: number
  originWidth: number
  pointerId: number
  startClientX: number
  startClientY: number
}

type BoardEntityRendererProps = {
  entity: BoardEntity
  onBeginEntityDrag: (event: ReactPointerEvent<EntityPointerTarget>, entityId: string) => void
  onConnectToEntity: (entityId: string) => void
  onFocusEntityOnCanvas: (entityId: string) => void
  onPrimarySelectionChange: (entityId: string | null) => void
  onResizeStart: (input: ResizeStart) => void
  onShiftLinkToEntity: (entityId: string) => boolean
  remoteSelectionColor?: string
  stageRef: RefObject<HTMLDivElement | null>
}

const MAP_KIND_BADGE_TONE = {
  blocker: "critical",
  evidence: "success",
  handoff: "warning",
  hypothesis: "secondary",
  scope: "info",
} as const

const MAP_SURFACE_TONES: Record<keyof typeof MAP_KIND_BADGE_TONE, SurfaceTone & { badgeVariant: BadgeVariant }> = {
  blocker: { accent: "#dc2626", badgeVariant: "critical", tint: "rgba(220, 38, 38, 0.18)" },
  evidence: { accent: "#16a34a", badgeVariant: "success", tint: "rgba(22, 163, 74, 0.18)" },
  handoff: { accent: "#d97706", badgeVariant: "warning", tint: "rgba(217, 119, 6, 0.18)" },
  hypothesis: { accent: "#7c3aed", badgeVariant: "secondary", tint: "rgba(124, 58, 237, 0.18)" },
  scope: { accent: "#2563eb", badgeVariant: "info", tint: "rgba(37, 99, 235, 0.18)" },
}

function getNoteSurfaceTone(entity: NoteEntity): SurfaceTone {
  if (entity.mapKind) {
    return MAP_SURFACE_TONES[entity.mapKind]
  }

  return { accent: entity.color, tint: entity.color }
}

function getIncidentSurfaceTone(entity: IncidentCardEntity): SurfaceTone {
  if (entity.mapKind === "scope") {
    return MAP_SURFACE_TONES.scope
  }

  switch (entity.severity) {
    case "critical":
      return { accent: "#b91c1c", tint: "rgba(185, 28, 28, 0.16)" }
    case "high":
      return { accent: "#dc2626", tint: "rgba(220, 38, 38, 0.12)" }
    case "medium":
      return { accent: "#d97706", tint: "rgba(217, 119, 6, 0.14)" }
    case "low":
    default:
      return { accent: "#2563eb", tint: "rgba(37, 99, 235, 0.12)" }
  }
}

export function BoardEntityRenderer({
  entity,
  onBeginEntityDrag,
  onConnectToEntity,
  onFocusEntityOnCanvas,
  onPrimarySelectionChange,
  onResizeStart,
  onShiftLinkToEntity,
  remoteSelectionColor,
  stageRef,
}: BoardEntityRendererProps) {
  const { areZonesEditable, pendingConnectionSourceId, setIsCanvasVisualMode } = useBoardUI()
  const {
    selectedEntityIds,
    selectSingleEntity: onSelectSingleEntity,
    toggleEntitySelection: onToggleEntitySelection,
  } = useBoardSelection()
  const { incidentActions, incidentLog, updateEntity } = useBoardEntities()

  const isSelected = selectedEntityIds.includes(entity.id)
  const linkedEntryCount = incidentLog.filter((entry) =>
    entry.linkedEntityIds.includes(entity.id),
  ).length
  const linkedActionCount = incidentActions.filter((action) =>
    action.linkedEntityIds.includes(entity.id),
  ).length
  const mapKind = getEntityMapKind(entity)
  const isZoneLocked = entity.type === "investigationZone" && !areZonesEditable

  const shellStyle: CSSProperties = {
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
  }

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
    setIsCanvasVisualMode(false)

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

  const connectionProps = { onConnectToEntity, pendingConnectionSourceId }
  const baseProps = {
    handleEntityDoubleClick,
    handleEntityDragStart,
    onSelectSingleEntity,
    resizeHandle,
    shellStyle,
    updateEntity,
  }

  if (entity.type === "investigationZone") {
    return (
      <ZoneEntityCard
        {...baseProps}
        areZonesEditable={areZonesEditable}
        entity={entity}
        isSelected={isSelected}
        isZoneLocked={isZoneLocked}
      />
    )
  }

  if (entity.type === "note") {
    return (
      <NoteEntityCard
        {...baseProps}
        {...connectionProps}
        entity={entity}
        metaBadges={metaBadges}
        surfaceTone={getNoteSurfaceTone(entity)}
      />
    )
  }

  if (entity.type === "incidentCard") {
    return (
      <IncidentEntityCard
        {...baseProps}
        {...connectionProps}
        entity={entity}
        metaBadges={metaBadges}
        surfaceTone={getIncidentSurfaceTone(entity)}
      />
    )
  }

  if (entity.type === "statusMarker") {
    return (
      <StatusMarkerEntityCard
        entity={entity}
        handleEntityDoubleClick={handleEntityDoubleClick}
        handleEntityDragStart={handleEntityDragStart}
        shellStyle={shellStyle}
      />
    )
  }

  if (entity.type === "reasoning") {
    return (
      <ReasoningEntityCard
        entity={entity}
        handleEntityDragStart={handleEntityDragStart}
        shellStyle={shellStyle}
      />
    )
  }

  return (
    <ScreenTileEntityCard
      {...baseProps}
      {...connectionProps}
      entity={entity}
    />
  )
}

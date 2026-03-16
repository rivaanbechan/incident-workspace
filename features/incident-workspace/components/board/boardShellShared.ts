import type {
  BoardEntity,
  IncidentCardEntity,
  InvestigationMapKind,
  NoteEntity,
} from "@/features/incident-workspace/lib/board/types"

export type MainWorkspaceTab = "actions" | "canvas" | "feed" | "search"
export type RailPanel = "findings" | "tasks"
export type QuickCaptureMode = "action" | "timeline"

export type PendingMapPrompt = {
  entityId: string
  recommendedAction: "action" | "feed"
}

export const MAP_KIND_LABELS: Record<InvestigationMapKind, string> = {
  blocker: "Blocker",
  evidence: "Evidence",
  handoff: "Handoff",
  hypothesis: "Hypothesis",
  scope: "Impact",
}

export const ZONE_COLOR_SWATCHES = [
  "rgba(219, 234, 254, 0.42)",
  "rgba(220, 252, 231, 0.42)",
  "rgba(254, 243, 199, 0.42)",
  "rgba(243, 232, 255, 0.42)",
  "rgba(254, 226, 226, 0.42)",
]

export function isEditingElement(target: EventTarget | null) {
  const element = target as HTMLElement | null
  const tagName = element?.tagName

  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    element?.isContentEditable === true
  )
}

export function getEntityMapKind(entity: BoardEntity | null): InvestigationMapKind | null {
  if (!entity) {
    return null
  }

  if (entity.type === "incidentCard" && entity.mapKind === "scope") {
    return "scope"
  }

  if (entity.type === "note" && entity.mapKind) {
    return entity.mapKind
  }

  return null
}

export function isCasePromotableEntity(
  entity: BoardEntity | null,
): entity is IncidentCardEntity | NoteEntity {
  return entity?.type === "incidentCard" || entity?.type === "note"
}

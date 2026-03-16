export type EntityType =
  | "investigationZone"
  | "note"
  | "incidentCard"
  | "statusMarker"
  | "screenTile"

export type Severity = "low" | "medium" | "high" | "critical"
export type IncidentStatus = "open" | "monitoring" | "mitigated"
export type MarkerTone = "neutral" | "warn" | "danger" | "success"
export type IncidentTimelineEntryType =
  | "update"
  | "decision"
  | "owner_change"
  | "mitigation"
  | "comms"
export type IncidentRoleKey =
  | "incidentCommander"
  | "technicalLead"
  | "communicationsLead"
  | "operationsLead"
export type IncidentActionStatus = "open" | "in_progress" | "blocked" | "done"
export type BoardConnectionType =
  | "blocks"
  | "custom"
  | "mitigates"
  | "relates_to"
  | "supports"
export type InvestigationMapKind =
  | "blocker"
  | "evidence"
  | "handoff"
  | "hypothesis"
  | "scope"

export type CameraState = {
  x: number
  y: number
  zoom: number
}

export type BoardPoint = {
  x: number
  y: number
}

export type PresenceUser = {
  color: string
  id: string
  name: string
}

export type PresenceState = {
  cursor: BoardPoint | null
  roomId: string
  selectedEntityId: string | null
  user: PresenceUser
}

export type IncidentLogEntry = {
  authorColor: string
  authorId: string
  authorName: string
  body: string
  createdAt: number
  id: string
  linkedActionIds: string[]
  linkedEntityIds: string[]
  type: IncidentTimelineEntryType
}

export type IncidentSummary = {
  currentObjective: string
  impactSummary: string
  nextUpdateAt: string
  severity: Severity
  status: IncidentStatus
}

export type IncidentRoleAssignments = Record<IncidentRoleKey, string>

export type IncidentActionItem = {
  createdAt: number
  id: string
  linkedEntityIds: string[]
  owner: string
  sourceLogEntryId: string | null
  status: IncidentActionStatus
  title: string
  updatedAt: number
}

export type BoardConnection = {
  customLabel?: string
  createdAt: number
  id: string
  sourceEntityId: string
  targetEntityId: string
  type: BoardConnectionType
  updatedAt: number
}

type BaseEntity = {
  createdAt: number
  height: number
  id: string
  type: EntityType
  updatedAt: number
  width: number
  x: number
  y: number
  zIndex: number
}

export type InvestigationZoneEntity = BaseEntity & {
  color: string
  title: string
  type: "investigationZone"
}

export type NoteEntity = BaseEntity & {
  body: string
  color: string
  mapKind?: Extract<InvestigationMapKind, "blocker" | "evidence" | "handoff" | "hypothesis">
  owner?: string
  sourceLabel?: string
  state?: "new" | "rejected" | "supported" | "testing"
  title: string
  type: "note"
}

export type IncidentCardEntity = BaseEntity & {
  body: string
  mapKind?: Extract<InvestigationMapKind, "scope">
  owner?: string
  severity: Severity
  scopeType?: "detection" | "host" | "identity" | "service" | "tenant"
  status: IncidentStatus
  title: string
  type: "incidentCard"
}

export type StatusMarkerEntity = BaseEntity & {
  label: string
  tone: MarkerTone
  type: "statusMarker"
}

export type ScreenTileEntity = BaseEntity & {
  participantId: string | null
  status: "active" | "placeholder"
  title: string
  trackId: string | null
  type: "screenTile"
}

export type BoardEntity =
  | InvestigationZoneEntity
  | NoteEntity
  | IncidentCardEntity
  | StatusMarkerEntity
  | ScreenTileEntity

import type {
  BoardConnection,
  BoardConnectionType,
  BoardPoint,
  IncidentActionItem,
  IncidentCardEntity,
  IncidentLogEntry,
  IncidentRoleAssignments,
  IncidentSummary,
  InvestigationZoneEntity,
  NoteEntity,
  PresenceUser,
  ReasoningEntity,
  ScreenTileEntity,
  StatusMarkerEntity,
} from "@/features/incident-workspace/lib/board/types"
import { DEFAULT_MAP_CARD_HEIGHT, DEFAULT_MAP_CARD_WIDTH } from "./boardConstants"

const USER_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#0ea5e9", "#8b5cf6"]
const USER_NAMES = ["Falcon", "Vector", "Beacon", "Atlas", "Signal"]
const NOTE_COLORS = ["#fef08a", "#fde68a", "#bfdbfe", "#c7f9cc"]
const ZONE_COLORS = ["rgba(219, 234, 254, 0.42)", "rgba(220, 252, 231, 0.42)", "rgba(254, 243, 199, 0.42)"]

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function createUser() {
  const seed = Math.floor(Math.random() * USER_NAMES.length)
  return {
    color: USER_COLORS[seed % USER_COLORS.length],
    id: createId("user"),
    name: USER_NAMES[seed],
  } satisfies PresenceUser
}

export function createNote(point: BoardPoint, zIndex: number): NoteEntity {
  return {
    body: "Capture key facts, owner, and next action.",
    color: NOTE_COLORS[zIndex % NOTE_COLORS.length],
    createdAt: Date.now(),
    height: DEFAULT_MAP_CARD_HEIGHT,
    id: createId("note"),
    title: "New note",
    type: "note",
    updatedAt: Date.now(),
    width: DEFAULT_MAP_CARD_WIDTH,
    x: point.x,
    y: point.y,
    zIndex,
  }
}

export function createInvestigationZone(point: BoardPoint, zIndex: number): InvestigationZoneEntity {
  return {
    color: ZONE_COLORS[Math.abs(zIndex) % ZONE_COLORS.length],
    createdAt: Date.now(),
    height: 460,
    id: createId("zone"),
    title: "New zone",
    type: "investigationZone",
    updatedAt: Date.now(),
    width: 680,
    x: point.x,
    y: point.y,
    zIndex,
  }
}

export function createIncidentCard(point: BoardPoint, zIndex: number): IncidentCardEntity {
  return {
    body: "Impact: degraded service\nOwner: on-call\nMitigation: investigating",
    createdAt: Date.now(),
    height: DEFAULT_MAP_CARD_HEIGHT,
    id: createId("incident"),
    severity: "high",
    status: "open",
    title: "Incident card",
    type: "incidentCard",
    updatedAt: Date.now(),
    width: DEFAULT_MAP_CARD_WIDTH,
    x: point.x,
    y: point.y,
    zIndex,
  }
}

export function createStatusMarker(point: BoardPoint, zIndex: number): StatusMarkerEntity {
  return {
    createdAt: Date.now(),
    height: 52,
    id: createId("status"),
    label: "Watching",
    tone: "warn",
    type: "statusMarker",
    updatedAt: Date.now(),
    width: 152,
    x: point.x,
    y: point.y,
    zIndex,
  }
}

export function createManagedScreenTile(
  screenShare: { participantId: string; participantName: string; trackId: string },
  index: number,
  zIndex: number,
): ScreenTileEntity {
  const width = 520
  const height = 340
  const columns = 2
  const column = index % columns
  const row = Math.floor(index / columns)
  return {
    createdAt: Date.now(),
    height,
    id: `live-screen-tile-${screenShare.trackId}`,
    participantId: screenShare.participantId,
    status: "active",
    title: `${screenShare.participantName} screen`,
    trackId: screenShare.trackId,
    type: "screenTile",
    updatedAt: Date.now(),
    width,
    x: 120 + column * (width + 40),
    y: 320 + row * (height + 40),
    zIndex,
  }
}

export function createIncidentLogEntry(user: PresenceUser, body: string): IncidentLogEntry {
  return {
    authorColor: user.color,
    authorId: user.id,
    authorName: user.name,
    body,
    createdAt: Date.now(),
    id: createId("log"),
    linkedActionIds: [],
    linkedEntityIds: [],
    type: "update",
  }
}

export function createTypedIncidentLogEntry(
  user: PresenceUser,
  input: { body: string; linkedActionIds?: string[]; linkedEntityIds?: string[]; type: IncidentLogEntry["type"] },
): IncidentLogEntry {
  return {
    ...createIncidentLogEntry(user, input.body),
    linkedActionIds: input.linkedActionIds ?? [],
    linkedEntityIds: input.linkedEntityIds ?? [],
    type: input.type,
  }
}

export function createIncidentSummary(): IncidentSummary {
  return {
    currentObjective: "Stabilize customer impact and confirm current mitigation owner.",
    impactSummary: "Customer impact not yet confirmed.",
    nextUpdateAt: "",
    severity: "high",
    status: "open",
  }
}

export function createIncidentRoleAssignments(): IncidentRoleAssignments {
  return {
    communicationsLead: "",
    incidentCommander: "",
    operationsLead: "",
    technicalLead: "",
  }
}

export function createIncidentActionItem(
  title: string,
  options?: { linkedEntityIds?: string[]; sourceLogEntryId?: string | null },
): IncidentActionItem {
  return {
    createdAt: Date.now(),
    id: createId("action"),
    linkedEntityIds: options?.linkedEntityIds ?? [],
    owner: "",
    sourceLogEntryId: options?.sourceLogEntryId ?? null,
    status: "open",
    title,
    updatedAt: Date.now(),
  }
}

export function createBoardConnection(
  sourceEntityId: string,
  targetEntityId: string,
  type: BoardConnectionType,
  customLabel?: string,
): BoardConnection {
  return {
    customLabel:
      type === "custom" && typeof customLabel === "string" && customLabel.trim().length > 0
        ? customLabel.trim()
        : undefined,
    createdAt: Date.now(),
    id: createId("connection"),
    sourceEntityId,
    targetEntityId,
    type,
    updatedAt: Date.now(),
  }
}

export function createReasoningEntity(
  agentId: string,
  agentName: string,
  invokingUserId: string,
  focusEntityId: string,
  position: BoardPoint,
  zIndex: number,
): import("@/features/incident-workspace/lib/board/types").ReasoningEntity {
  return {
    agentId,
    agentName,
    createdAt: Date.now(),
    focusEntityId,
    height: DEFAULT_MAP_CARD_HEIGHT,
    id: createId("reasoning"),
    invokingUserId,
    narrative: "",
    status: "running",
    title: agentName,
    toolCallSummary: "",
    type: "reasoning",
    updatedAt: Date.now(),
    width: DEFAULT_MAP_CARD_WIDTH,
    x: position.x,
    y: position.y,
    zIndex,
  }
}

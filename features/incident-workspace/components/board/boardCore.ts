import type {
  BoardConnection,
  BoardConnectionType,
  BoardEntity,
  BoardPoint,
  CameraState,
  IncidentActionItem,
  IncidentCardEntity,
  IncidentLogEntry,
  InvestigationZoneEntity,
  IncidentRoleAssignments,
  IncidentRoleKey,
  IncidentSummary,
  NoteEntity,
  PresenceState,
  PresenceUser,
  ReasoningEntity,
  ScreenTileEntity,
  StatusMarkerEntity,
} from "@/features/incident-workspace/lib/board/types"
import * as Y from "yjs"

export type ConnectionStatus = "connected" | "connecting" | "disconnected"

export const DEFAULT_CAMERA: CameraState = {
  x: 96,
  y: 96,
  zoom: 1,
}
export const DEFAULT_MAP_CARD_WIDTH = 460
export const DEFAULT_MAP_CARD_HEIGHT = 420

const USER_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#0ea5e9", "#8b5cf6"]
const USER_NAMES = ["Falcon", "Vector", "Beacon", "Atlas", "Signal"]
const NOTE_COLORS = ["#fef08a", "#fde68a", "#bfdbfe", "#c7f9cc"]
const ZONE_COLORS = ["rgba(219, 234, 254, 0.42)", "rgba(220, 252, 231, 0.42)", "rgba(254, 243, 199, 0.42)"]
const INCIDENT_ROLE_KEYS: IncidentRoleKey[] = [
  "incidentCommander",
  "technicalLead",
  "communicationsLead",
  "operationsLead",
]

export function getCollabServerUrl() {
  if (process.env.NEXT_PUBLIC_Y_WEBSOCKET_URL) {
    return process.env.NEXT_PUBLIC_Y_WEBSOCKET_URL
  }

  if (typeof window === "undefined") {
    return "ws://localhost:1234"
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"

  return `${protocol}//${window.location.hostname}:1234`
}

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

export function createInvestigationZone(
  point: BoardPoint,
  zIndex: number,
): InvestigationZoneEntity {
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

export function createIncidentCard(
  point: BoardPoint,
  zIndex: number,
): IncidentCardEntity {
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

export function createStatusMarker(
  point: BoardPoint,
  zIndex: number,
): StatusMarkerEntity {
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
  screenShare: {
    participantId: string
    participantName: string
    trackId: string
  },
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
  input: {
    body: string
    linkedActionIds?: string[]
    linkedEntityIds?: string[]
    type: IncidentLogEntry["type"]
  },
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
  options?: {
    linkedEntityIds?: string[]
    sourceLogEntryId?: string | null
  },
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

export function parseEntity(value: unknown): BoardEntity | null {
  if (typeof value !== "string") {
    return null
  }

  try {
    const entity = JSON.parse(value) as BoardEntity

    if (!entity || typeof entity !== "object" || typeof entity.id !== "string") {
      return null
    }

    return entity
  } catch {
    return null
  }
}

export function readEntities(entityMap: Y.Map<string>) {
  return Array.from(entityMap.values())
    .map(parseEntity)
    .filter((entity): entity is BoardEntity => entity !== null)
    .sort((left, right) => left.zIndex - right.zIndex)
}

export function serializeEntity(entity: BoardEntity) {
  return JSON.stringify(entity)
}

export function parseBoardConnection(value: unknown): BoardConnection | null {
  if (typeof value !== "string") {
    return null
  }

  try {
    const connection = JSON.parse(value) as Partial<BoardConnection>

    if (
      !connection ||
      typeof connection !== "object" ||
      typeof connection.id !== "string" ||
      typeof connection.sourceEntityId !== "string" ||
      typeof connection.targetEntityId !== "string" ||
      typeof connection.createdAt !== "number" ||
      typeof connection.updatedAt !== "number"
    ) {
      return null
    }

    return {
      customLabel:
        connection.type === "custom" && typeof connection.customLabel === "string"
          ? connection.customLabel
          : undefined,
      createdAt: connection.createdAt,
      id: connection.id,
      sourceEntityId: connection.sourceEntityId,
      targetEntityId: connection.targetEntityId,
      type:
        connection.type === "blocks" ||
        connection.type === "custom" ||
        connection.type === "derived_from" ||
        connection.type === "mitigates" ||
        connection.type === "relates_to"
          ? connection.type
          : "supports",
      updatedAt: connection.updatedAt,
    }
  } catch {
    return null
  }
}

export function readBoardConnections(connections: Y.Array<string>) {
  return connections
    .toArray()
    .map(parseBoardConnection)
    .filter((connection): connection is BoardConnection => connection !== null)
    .sort((left, right) => left.createdAt - right.createdAt)
}

export function serializeBoardConnection(connection: BoardConnection) {
  return JSON.stringify(connection)
}

export function parseIncidentLogEntry(value: unknown): IncidentLogEntry | null {
  if (typeof value !== "string") {
    return null
  }

  try {
    const entry = JSON.parse(value) as Partial<IncidentLogEntry>

    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.id !== "string" ||
      typeof entry.body !== "string" ||
      typeof entry.authorName !== "string" ||
      typeof entry.createdAt !== "number"
    ) {
      return null
    }

    return {
      authorColor: typeof entry.authorColor === "string" ? entry.authorColor : "#94a3b8",
      authorId: typeof entry.authorId === "string" ? entry.authorId : "unknown",
      authorName: entry.authorName,
      body: entry.body,
      createdAt: entry.createdAt,
      id: entry.id,
      linkedActionIds: Array.isArray(entry.linkedActionIds)
        ? entry.linkedActionIds.filter((value): value is string => typeof value === "string")
        : [],
      linkedEntityIds: Array.isArray(entry.linkedEntityIds)
        ? entry.linkedEntityIds.filter((value): value is string => typeof value === "string")
        : [],
      type:
        entry.type === "decision" ||
        entry.type === "owner_change" ||
        entry.type === "mitigation" ||
        entry.type === "comms"
          ? entry.type
          : "update",
    }
  } catch {
    return null
  }
}

export function readIncidentLog(logEntries: Y.Array<string>) {
  return logEntries
    .toArray()
    .map(parseIncidentLogEntry)
    .filter((entry): entry is IncidentLogEntry => entry !== null)
    .sort((left, right) => left.createdAt - right.createdAt)
}

export function serializeIncidentLogEntry(entry: IncidentLogEntry) {
  return JSON.stringify(entry)
}

export function parseIncidentSummary(value: unknown): IncidentSummary | null {
  if (typeof value !== "string") {
    return null
  }

  try {
    const summary = JSON.parse(value) as Partial<IncidentSummary>

    if (!summary || typeof summary !== "object") {
      return null
    }

    const status =
      summary.status === "monitoring" || summary.status === "mitigated"
        ? summary.status
        : "open"
    const severity =
      summary.severity === "low" ||
      summary.severity === "medium" ||
      summary.severity === "critical"
        ? summary.severity
        : "high"

    return {
      currentObjective:
        typeof summary.currentObjective === "string"
          ? summary.currentObjective
          : createIncidentSummary().currentObjective,
      impactSummary:
        typeof summary.impactSummary === "string"
          ? summary.impactSummary
          : createIncidentSummary().impactSummary,
      nextUpdateAt: typeof summary.nextUpdateAt === "string" ? summary.nextUpdateAt : "",
      severity,
      status,
    }
  } catch {
    return null
  }
}

export function serializeIncidentSummary(summary: IncidentSummary) {
  return JSON.stringify(summary)
}

export function parseIncidentRoleAssignments(
  value: unknown,
): IncidentRoleAssignments | null {
  if (typeof value !== "string") {
    return null
  }

  try {
    const roles = JSON.parse(value) as Partial<IncidentRoleAssignments>

    if (!roles || typeof roles !== "object") {
      return null
    }

    return INCIDENT_ROLE_KEYS.reduce<IncidentRoleAssignments>((nextRoles, roleKey) => {
      nextRoles[roleKey] = typeof roles[roleKey] === "string" ? roles[roleKey] : ""
      return nextRoles
    }, createIncidentRoleAssignments())
  } catch {
    return null
  }
}

export function serializeIncidentRoleAssignments(roles: IncidentRoleAssignments) {
  return JSON.stringify(roles)
}

export function parseIncidentActionItem(value: unknown): IncidentActionItem | null {
  if (typeof value !== "string") {
    return null
  }

  try {
    const action = JSON.parse(value) as Partial<IncidentActionItem>

    if (
      !action ||
      typeof action !== "object" ||
      typeof action.id !== "string" ||
      typeof action.title !== "string" ||
      typeof action.createdAt !== "number" ||
      typeof action.updatedAt !== "number"
    ) {
      return null
    }

    return {
      createdAt: action.createdAt,
      id: action.id,
      linkedEntityIds: Array.isArray(action.linkedEntityIds)
        ? action.linkedEntityIds.filter((value): value is string => typeof value === "string")
        : [],
      owner: typeof action.owner === "string" ? action.owner : "",
      sourceLogEntryId:
        typeof action.sourceLogEntryId === "string" ? action.sourceLogEntryId : null,
      status:
        action.status === "in_progress" ||
        action.status === "blocked" ||
        action.status === "done"
          ? action.status
          : "open",
      title: action.title,
      updatedAt: action.updatedAt,
    }
  } catch {
    return null
  }
}

export function readIncidentActionItems(actions: Y.Array<string>) {
  return actions
    .toArray()
    .map(parseIncidentActionItem)
    .filter((action): action is IncidentActionItem => action !== null)
    .sort((left, right) => left.createdAt - right.createdAt)
}

export function serializeIncidentActionItem(action: IncidentActionItem) {
  return JSON.stringify(action)
}

export function formatLogTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(timestamp))
}

export function screenToBoard(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  camera: CameraState,
) {
  return {
    x: (clientX - rect.left - camera.x) / camera.zoom,
    y: (clientY - rect.top - camera.y) / camera.zoom,
  }
}

export function boardToScreen(
  point: BoardPoint,
  rect: DOMRect,
  camera: CameraState,
) {
  return {
    x: rect.left + camera.x + point.x * camera.zoom,
    y: rect.top + camera.y + point.y * camera.zoom,
  }
}

export function isPresenceState(value: unknown): value is PresenceState {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as PresenceState

  return (
    typeof candidate.roomId === "string" &&
    typeof candidate.user?.id === "string" &&
    typeof candidate.user?.name === "string" &&
    typeof candidate.user?.color === "string"
  )
}

export function nextZIndex(entities: BoardEntity[]) {
  return entities.reduce((max, entity) => Math.max(max, entity.zIndex), 0) + 1
}

export function nextBackgroundZIndex(entities: BoardEntity[]) {
  return entities.reduce((min, entity) => Math.min(min, entity.zIndex), 0) - 1
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function createReasoningEntity(
  agentId: string,
  agentName: string,
  invokingUserId: string,
  focusEntityId: string,
  position: BoardPoint,
  zIndex: number,
): ReasoningEntity {
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

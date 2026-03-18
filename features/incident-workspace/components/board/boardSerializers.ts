import type {
  BoardConnection,
  BoardEntity,
  IncidentActionItem,
  IncidentLogEntry,
  IncidentRoleAssignments,
  IncidentRoleKey,
  IncidentSummary,
} from "@/features/incident-workspace/lib/board/types"
import { createIncidentSummary, createIncidentRoleAssignments } from "./boardFactories"
import * as Y from "yjs"

const INCIDENT_ROLE_KEYS: IncidentRoleKey[] = [
  "incidentCommander",
  "technicalLead",
  "communicationsLead",
  "operationsLead",
]

export function parseEntity(value: unknown): BoardEntity | null {
  if (typeof value !== "string") return null
  try {
    const entity = JSON.parse(value) as BoardEntity
    if (!entity || typeof entity !== "object" || typeof entity.id !== "string") return null
    return entity
  } catch { return null }
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
  if (typeof value !== "string") return null
  try {
    const connection = JSON.parse(value) as Partial<BoardConnection>
    if (
      !connection || typeof connection !== "object" ||
      typeof connection.id !== "string" ||
      typeof connection.sourceEntityId !== "string" ||
      typeof connection.targetEntityId !== "string" ||
      typeof connection.createdAt !== "number" ||
      typeof connection.updatedAt !== "number"
    ) return null
    return {
      customLabel:
        connection.type === "custom" && typeof connection.customLabel === "string"
          ? connection.customLabel : undefined,
      createdAt: connection.createdAt,
      id: connection.id,
      sourceEntityId: connection.sourceEntityId,
      targetEntityId: connection.targetEntityId,
      type:
        connection.type === "blocks" || connection.type === "custom" ||
        connection.type === "derived_from" || connection.type === "mitigates" ||
        connection.type === "relates_to" ? connection.type : "supports",
      updatedAt: connection.updatedAt,
    }
  } catch { return null }
}

export function readBoardConnections(connections: Y.Array<string>) {
  return connections.toArray()
    .map(parseBoardConnection)
    .filter((connection): connection is BoardConnection => connection !== null)
    .sort((left, right) => left.createdAt - right.createdAt)
}

export function serializeBoardConnection(connection: BoardConnection) {
  return JSON.stringify(connection)
}

export function parseIncidentLogEntry(value: unknown): IncidentLogEntry | null {
  if (typeof value !== "string") return null
  try {
    const entry = JSON.parse(value) as Partial<IncidentLogEntry>
    if (
      !entry || typeof entry !== "object" ||
      typeof entry.id !== "string" || typeof entry.body !== "string" ||
      typeof entry.authorName !== "string" || typeof entry.createdAt !== "number"
    ) return null
    return {
      authorColor: typeof entry.authorColor === "string" ? entry.authorColor : "#94a3b8",
      authorId: typeof entry.authorId === "string" ? entry.authorId : "unknown",
      authorName: entry.authorName,
      body: entry.body,
      createdAt: entry.createdAt,
      id: entry.id,
      linkedActionIds: Array.isArray(entry.linkedActionIds)
        ? entry.linkedActionIds.filter((v): v is string => typeof v === "string") : [],
      linkedEntityIds: Array.isArray(entry.linkedEntityIds)
        ? entry.linkedEntityIds.filter((v): v is string => typeof v === "string") : [],
      type:
        entry.type === "decision" || entry.type === "owner_change" ||
        entry.type === "mitigation" || entry.type === "comms" ? entry.type : "update",
    }
  } catch { return null }
}

export function readIncidentLog(logEntries: Y.Array<string>) {
  return logEntries.toArray()
    .map(parseIncidentLogEntry)
    .filter((entry): entry is IncidentLogEntry => entry !== null)
    .sort((left, right) => left.createdAt - right.createdAt)
}

export function serializeIncidentLogEntry(entry: IncidentLogEntry) {
  return JSON.stringify(entry)
}

export function parseIncidentSummary(value: unknown): IncidentSummary | null {
  if (typeof value !== "string") return null
  try {
    const summary = JSON.parse(value) as Partial<IncidentSummary>
    if (!summary || typeof summary !== "object") return null
    const status = summary.status === "monitoring" || summary.status === "mitigated" ? summary.status : "open"
    const severity =
      summary.severity === "low" || summary.severity === "medium" || summary.severity === "critical"
        ? summary.severity : "high"
    return {
      currentObjective: typeof summary.currentObjective === "string"
        ? summary.currentObjective : createIncidentSummary().currentObjective,
      impactSummary: typeof summary.impactSummary === "string"
        ? summary.impactSummary : createIncidentSummary().impactSummary,
      nextUpdateAt: typeof summary.nextUpdateAt === "string" ? summary.nextUpdateAt : "",
      severity,
      status,
    }
  } catch { return null }
}

export function serializeIncidentSummary(summary: IncidentSummary) {
  return JSON.stringify(summary)
}

export function parseIncidentRoleAssignments(value: unknown): IncidentRoleAssignments | null {
  if (typeof value !== "string") return null
  try {
    const roles = JSON.parse(value) as Partial<IncidentRoleAssignments>
    if (!roles || typeof roles !== "object") return null
    return INCIDENT_ROLE_KEYS.reduce<IncidentRoleAssignments>((nextRoles, roleKey) => {
      nextRoles[roleKey] = typeof roles[roleKey] === "string" ? roles[roleKey] : ""
      return nextRoles
    }, createIncidentRoleAssignments())
  } catch { return null }
}

export function serializeIncidentRoleAssignments(roles: IncidentRoleAssignments) {
  return JSON.stringify(roles)
}

export function parseIncidentActionItem(value: unknown): IncidentActionItem | null {
  if (typeof value !== "string") return null
  try {
    const action = JSON.parse(value) as Partial<IncidentActionItem>
    if (
      !action || typeof action !== "object" ||
      typeof action.id !== "string" || typeof action.title !== "string" ||
      typeof action.createdAt !== "number" || typeof action.updatedAt !== "number"
    ) return null
    return {
      createdAt: action.createdAt,
      id: action.id,
      linkedEntityIds: Array.isArray(action.linkedEntityIds)
        ? action.linkedEntityIds.filter((v): v is string => typeof v === "string") : [],
      owner: typeof action.owner === "string" ? action.owner : "",
      sourceLogEntryId: typeof action.sourceLogEntryId === "string" ? action.sourceLogEntryId : null,
      status:
        action.status === "in_progress" || action.status === "blocked" || action.status === "done"
          ? action.status : "open",
      title: action.title,
      updatedAt: action.updatedAt,
    }
  } catch { return null }
}

export function readIncidentActionItems(actions: Y.Array<string>) {
  return actions.toArray()
    .map(parseIncidentActionItem)
    .filter((action): action is IncidentActionItem => action !== null)
    .sort((left, right) => left.createdAt - right.createdAt)
}

export function serializeIncidentActionItem(action: IncidentActionItem) {
  return JSON.stringify(action)
}

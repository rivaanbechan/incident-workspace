import { createSchemaGuard, dbQuery, getDbPool } from "@/lib/db/index"
import * as Y from "yjs"

type RoomDocumentSummary = {
  boardEntityCount: number
  openActionCount: number
  timelineEntryCount: number
}

export type RoomDocumentDetail = {
  entities: Array<{
    body: string
    id: string
    kind: "incidentCard" | "investigationZone" | "note" | "statusMarker"
    mapKind: string | null
    owner: string | null
    severity: string | null
    status: string | null
    title: string
  }>
  incidentActions: Array<{
    id: string
    owner: string
    status: string
    title: string
    updatedAt: number
  }>
  incidentLog: Array<{
    body: string
    createdAt: number
    id: string
    linkedActionIds: string[]
    linkedEntityIds: string[]
    type: string
  }>
  summary: RoomDocumentSummary
}

const ensureRoomDocumentSchema = createSchemaGuard(async () => {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS room_documents (
      room_id TEXT PRIMARY KEY,
      yjs_state BYTEA NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
})

export async function deleteRoomDocument(roomId: string) {
  if (!getDbPool()) {
    return
  }

  await ensureRoomDocumentSchema()

  await dbQuery(
    `
      DELETE FROM room_documents
      WHERE room_id = $1
    `,
    [roomId],
  )
}

function summarizeRoomDocumentState(state: Uint8Array): RoomDocumentSummary {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, state)

  const entities = doc.getMap<string>("entities")
  const incidentLog = doc.getArray<string>("incident-log")
  const incidentActions = doc.getArray<string>("incident-actions")

  const boardEntityCount = Array.from(entities.values()).reduce((count, value) => {
    if (typeof value !== "string") {
      return count
    }

    try {
      const entity = JSON.parse(value) as { type?: string }
      return entity.type === "screenTile" ? count : count + 1
    } catch {
      return count
    }
  }, 0)

  const openActionCount = incidentActions.toArray().reduce((count, value) => {
    if (typeof value !== "string") {
      return count
    }

    try {
      const action = JSON.parse(value) as { status?: string }
      return action.status === "done" ? count : count + 1
    } catch {
      return count
    }
  }, 0)

  return {
    boardEntityCount,
    openActionCount,
    timelineEntryCount: incidentLog.length,
  }
}

function parseRoomDocumentDetail(state: Uint8Array): RoomDocumentDetail {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, state)

  const entityMap = doc.getMap<string>("entities")
  const incidentLog = doc.getArray<string>("incident-log")
  const incidentActions = doc.getArray<string>("incident-actions")

  const entities = Array.from(entityMap.values()).flatMap((value) => {
    if (typeof value !== "string") {
      return []
    }

    try {
      const entity = JSON.parse(value) as {
        body?: string
        id?: string
        label?: string
        mapKind?: string
        owner?: string
        severity?: string
        status?: string
        title?: string
        type?: string
      }

      if (
        typeof entity.id !== "string" ||
        (entity.type !== "incidentCard" &&
          entity.type !== "investigationZone" &&
          entity.type !== "note" &&
          entity.type !== "statusMarker")
      ) {
        return []
      }

      return [
        {
          body:
            typeof entity.body === "string"
              ? entity.body
              : typeof entity.label === "string"
                ? entity.label
                : "",
          id: entity.id,
          kind: entity.type as "incidentCard" | "investigationZone" | "note" | "statusMarker",
          mapKind: typeof entity.mapKind === "string" ? entity.mapKind : null,
          owner: typeof entity.owner === "string" ? entity.owner : null,
          severity: typeof entity.severity === "string" ? entity.severity : null,
          status: typeof entity.status === "string" ? entity.status : null,
          title:
            typeof entity.title === "string"
              ? entity.title
              : typeof entity.label === "string"
                ? entity.label
                : entity.type,
        },
      ]
    } catch {
      return []
    }
  })

  const parsedIncidentLog = incidentLog.toArray().flatMap((value) => {
    if (typeof value !== "string") {
      return []
    }

    try {
      const entry = JSON.parse(value) as {
        body?: string
        createdAt?: number
        id?: string
        linkedActionIds?: string[]
        linkedEntityIds?: string[]
        type?: string
      }

      if (
        typeof entry.id !== "string" ||
        typeof entry.body !== "string" ||
        typeof entry.createdAt !== "number"
      ) {
        return []
      }

      return [
        {
          body: entry.body,
          createdAt: entry.createdAt,
          id: entry.id,
          linkedActionIds: Array.isArray(entry.linkedActionIds)
            ? entry.linkedActionIds.filter((item): item is string => typeof item === "string")
            : [],
          linkedEntityIds: Array.isArray(entry.linkedEntityIds)
            ? entry.linkedEntityIds.filter((item): item is string => typeof item === "string")
            : [],
          type: typeof entry.type === "string" ? entry.type : "update",
        },
      ]
    } catch {
      return []
    }
  })

  const parsedIncidentActions = incidentActions.toArray().flatMap((value) => {
    if (typeof value !== "string") {
      return []
    }

    try {
      const action = JSON.parse(value) as {
        id?: string
        owner?: string
        status?: string
        title?: string
        updatedAt?: number
      }

      if (
        typeof action.id !== "string" ||
        typeof action.title !== "string" ||
        typeof action.updatedAt !== "number"
      ) {
        return []
      }

      return [
        {
          id: action.id,
          owner: typeof action.owner === "string" ? action.owner : "",
          status: typeof action.status === "string" ? action.status : "open",
          title: action.title,
          updatedAt: action.updatedAt,
        },
      ]
    } catch {
      return []
    }
  })

  return {
    entities,
    incidentActions: parsedIncidentActions,
    incidentLog: parsedIncidentLog,
    summary: summarizeRoomDocumentState(state),
  }
}

export async function listRoomDocumentSummaries(roomIds: string[]) {
  if (!getDbPool() || roomIds.length === 0) {
    return new Map<string, RoomDocumentSummary>()
  }

  await ensureRoomDocumentSchema()

  const result = await dbQuery<{
    room_id: string
    yjs_state: Buffer
  }>(
    `
      SELECT room_id, yjs_state
      FROM room_documents
      WHERE room_id = ANY($1::text[])
    `,
    [roomIds],
  )

  return new Map(
    result.rows.map((row) => [
      row.room_id,
      summarizeRoomDocumentState(new Uint8Array(row.yjs_state)),
    ]),
  )
}

export async function getRoomDocumentDetail(roomId: string) {
  if (!getDbPool()) {
    return null
  }

  await ensureRoomDocumentSchema()

  const result = await dbQuery<{
    yjs_state: Buffer
  }>(
    `
      SELECT yjs_state
      FROM room_documents
      WHERE room_id = $1
      LIMIT 1
    `,
    [roomId],
  )

  const state = result.rows[0]?.yjs_state

  if (!state) {
    return null
  }

  return parseRoomDocumentDetail(new Uint8Array(state))
}

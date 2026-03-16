import { createSchemaGuard, dbQuery, generateId, getDbPool } from "@/lib/db/index"
import type {
  HuntGraphSnapshot,
  SavedHuntGraphViewDetail,
  SavedHuntGraphViewRecord,
} from "@/features/collab-hunt-graph/lib/types"

const ensureHuntGraphSchema = createSchemaGuard(async () => {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS hunt_graph_saved_views (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      title TEXT NOT NULL,
      adapter_id TEXT,
      query TEXT NOT NULL DEFAULT '',
      snapshot JSONB NOT NULL,
      node_count INTEGER NOT NULL DEFAULT 0,
      edge_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await dbQuery(`
    CREATE INDEX IF NOT EXISTS hunt_graph_saved_views_room_id_idx
    ON hunt_graph_saved_views (room_id, updated_at DESC)
  `)
})

function assertDatabase() {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }
}

function mapSavedViewRow(row: {
  adapter_id: string | null
  created_at: string
  edge_count: number
  id: string
  node_count: number
  query: string
  room_id: string
  title: string
  updated_at: string
}): SavedHuntGraphViewRecord {
  return {
    adapterId: row.adapter_id,
    createdAt: row.created_at,
    edgeCount: row.edge_count,
    id: row.id,
    nodeCount: row.node_count,
    query: row.query,
    roomId: row.room_id,
    title: row.title,
    updatedAt: row.updated_at,
  }
}

export async function listSavedHuntGraphViews(roomId: string) {
  if (!getDbPool()) {
    return []
  }

  await ensureHuntGraphSchema()

  const result = await dbQuery<{
    adapter_id: string | null
    created_at: string
    edge_count: number
    id: string
    node_count: number
    query: string
    room_id: string
    title: string
    updated_at: string
  }>(
    `
      SELECT
        id,
        room_id,
        title,
        adapter_id,
        query,
        node_count,
        edge_count,
        created_at::text,
        updated_at::text
      FROM hunt_graph_saved_views
      WHERE room_id = $1
      ORDER BY updated_at DESC
    `,
    [roomId],
  )

  return result.rows.map(mapSavedViewRow)
}

export async function getSavedHuntGraphView(roomId: string, viewId: string) {
  if (!getDbPool()) {
    return null
  }

  await ensureHuntGraphSchema()

  const result = await dbQuery<{
    adapter_id: string | null
    created_at: string
    edge_count: number
    id: string
    node_count: number
    query: string
    room_id: string
    snapshot: HuntGraphSnapshot
    title: string
    updated_at: string
  }>(
    `
      SELECT
        id,
        room_id,
        title,
        adapter_id,
        query,
        snapshot,
        node_count,
        edge_count,
        created_at::text,
        updated_at::text
      FROM hunt_graph_saved_views
      WHERE room_id = $1 AND id = $2
      LIMIT 1
    `,
    [roomId, viewId],
  )

  const row = result.rows[0]

  if (!row) {
    return null
  }

  return {
    ...mapSavedViewRow(row),
    snapshot: row.snapshot,
  } satisfies SavedHuntGraphViewDetail
}

export async function saveHuntGraphView(input: {
  roomId: string
  snapshot: HuntGraphSnapshot
  title: string
  viewId?: string | null
}) {
  assertDatabase()
  await ensureHuntGraphSchema()

  const viewId = input.viewId?.trim() || generateId("view")
  const title = input.title.trim()

  if (!title) {
    throw new Error("A saved view title is required.")
  }

  await dbQuery(
    `
      INSERT INTO hunt_graph_saved_views (
        id,
        room_id,
        title,
        adapter_id,
        query,
        snapshot,
        node_count,
        edge_count,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        adapter_id = EXCLUDED.adapter_id,
        query = EXCLUDED.query,
        snapshot = EXCLUDED.snapshot,
        node_count = EXCLUDED.node_count,
        edge_count = EXCLUDED.edge_count,
        updated_at = NOW()
    `,
    [
      viewId,
      input.roomId,
      title,
      input.snapshot.adapterId,
      input.snapshot.query,
      JSON.stringify(input.snapshot),
      input.snapshot.nodes.length,
      input.snapshot.edges.length,
    ],
  )

  return getSavedHuntGraphView(input.roomId, viewId)
}

export async function deleteSavedHuntGraphViews(roomId: string) {
  if (!getDbPool()) {
    return
  }

  await ensureHuntGraphSchema()

  await dbQuery(
    `
      DELETE FROM hunt_graph_saved_views
      WHERE room_id = $1
    `,
    [roomId],
  )
}

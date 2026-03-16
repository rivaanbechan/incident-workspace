import type { DatasourceSearchRow, SavedDatasourceResultSet } from "@/lib/datasources"
import { createSchemaGuard, dbQuery, getDbPool } from "@/lib/db/index"
import { getInvestigationIdByRoom } from "@/lib/db/investigations"
import {
  deleteInvestigationEntityLinksForTarget,
  syncInvestigationEntityLinks,
} from "@/lib/db/investigationEntities"

type SavedDatasourceResultSetRow = {
  created_at: string
  datasource_id: string
  datasource_title: string
  earliest_time: string | null
  id: string
  latest_time: string | null
  query: string
  related_entities: SavedDatasourceResultSet["relatedEntities"]
  result_count: number
  room_id: string
  rows: DatasourceSearchRow[]
  summary: string
  title: string
  vendor: SavedDatasourceResultSet["vendor"]
}

export type CreateSavedDatasourceResultSetInput = {
  datasourceId: string
  datasourceTitle: string
  earliestTime?: string
  id: string
  latestTime?: string
  query: string
  relatedEntities: SavedDatasourceResultSet["relatedEntities"]
  resultCount: number
  roomId: string
  rows: DatasourceSearchRow[]
  summary: string
  title: string
  vendor: SavedDatasourceResultSet["vendor"]
}

const ensureSavedDatasourceResultSetSchema = createSchemaGuard(async () => {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS saved_datasource_result_sets (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      datasource_id TEXT NOT NULL,
      datasource_title TEXT NOT NULL,
      vendor TEXT NOT NULL,
      query TEXT NOT NULL,
      earliest_time TEXT,
      latest_time TEXT,
      result_count INTEGER NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      rows JSONB NOT NULL,
      related_entities JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await dbQuery(`
    CREATE INDEX IF NOT EXISTS saved_datasource_result_sets_room_id_idx
    ON saved_datasource_result_sets (room_id, created_at DESC)
  `)
})

function mapSavedDatasourceResultSetRow(
  row: SavedDatasourceResultSetRow,
): SavedDatasourceResultSet {
  return {
    createdAt: row.created_at,
    datasourceId: row.datasource_id,
    datasourceTitle: row.datasource_title,
    earliestTime: row.earliest_time,
    id: row.id,
    latestTime: row.latest_time,
    query: row.query,
    relatedEntities: row.related_entities,
    resultCount: row.result_count,
    roomId: row.room_id,
    rows: row.rows,
    summary: row.summary,
    title: row.title,
    vendor: row.vendor,
  }
}

export async function listSavedDatasourceResultSets(roomId: string) {
  if (!getDbPool()) {
    return []
  }

  await ensureSavedDatasourceResultSetSchema()

  const result = await dbQuery<SavedDatasourceResultSetRow>(
    `
      SELECT
        id,
        room_id,
        datasource_id,
        datasource_title,
        vendor,
        query,
        earliest_time,
        latest_time,
        result_count,
        title,
        summary,
        rows,
        related_entities,
        created_at::text
      FROM saved_datasource_result_sets
      WHERE room_id = $1
      ORDER BY created_at DESC
    `,
    [roomId],
  )

  return result.rows.map(mapSavedDatasourceResultSetRow)
}

export async function countSavedDatasourceResultSetsByRoom(roomIds: string[]) {
  if (!getDbPool() || roomIds.length === 0) {
    return new Map<string, number>()
  }

  await ensureSavedDatasourceResultSetSchema()

  const result = await dbQuery<{
    evidence_set_count: number
    room_id: string
  }>(
    `
      SELECT
        room_id,
        COUNT(*)::int AS evidence_set_count
      FROM saved_datasource_result_sets
      WHERE room_id = ANY($1::text[])
      GROUP BY room_id
    `,
    [roomIds],
  )

  return new Map(result.rows.map((row) => [row.room_id, row.evidence_set_count] as const))
}

export async function createSavedDatasourceResultSet(
  input: CreateSavedDatasourceResultSetInput,
) {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureSavedDatasourceResultSetSchema()

  const result = await dbQuery<SavedDatasourceResultSetRow>(
    `
      INSERT INTO saved_datasource_result_sets (
        id,
        room_id,
        datasource_id,
        datasource_title,
        vendor,
        query,
        earliest_time,
        latest_time,
        result_count,
        title,
        summary,
        rows,
        related_entities,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, NOW())
      RETURNING
        id,
        room_id,
        datasource_id,
        datasource_title,
        vendor,
        query,
        earliest_time,
        latest_time,
        result_count,
        title,
        summary,
        rows,
        related_entities,
        created_at::text
    `,
    [
      input.id,
      input.roomId,
      input.datasourceId,
      input.datasourceTitle,
      input.vendor,
      input.query,
      input.earliestTime ?? null,
      input.latestTime ?? null,
      input.resultCount,
      input.title,
      input.summary,
      JSON.stringify(input.rows),
      JSON.stringify(input.relatedEntities),
    ],
  )

  const investigationId = await getInvestigationIdByRoom(input.roomId)

  if (investigationId) {
    await syncInvestigationEntityLinks(
      investigationId,
      "evidence-set",
      input.id,
      input.relatedEntities,
    )
  }

  return mapSavedDatasourceResultSetRow(result.rows[0])
}

export async function deleteSavedDatasourceResultSets(roomId: string) {
  if (!getDbPool()) {
    return
  }

  await ensureSavedDatasourceResultSetSchema()

  const investigationId = await getInvestigationIdByRoom(roomId)
  const existingResultSets =
    investigationId
      ? await dbQuery<{ id: string }>(
          `
            SELECT id
            FROM saved_datasource_result_sets
            WHERE room_id = $1
          `,
          [roomId],
        )
      : null

  await dbQuery(
    `
      DELETE FROM saved_datasource_result_sets
      WHERE room_id = $1
    `,
    [roomId],
  )

  if (investigationId && existingResultSets) {
    for (const resultSet of existingResultSets.rows) {
      await deleteInvestigationEntityLinksForTarget(
        investigationId,
        "evidence-set",
        resultSet.id,
      )
    }
  }
}

export async function getEvidenceSetStubsByIds(investigationId: string, ids: string[]) {
  if (!getDbPool() || ids.length === 0) {
    return []
  }

  await ensureSavedDatasourceResultSetSchema()

  const result = await dbQuery<{
    id: string
    result_count: number
    summary: string
    title: string
  }>(
    `
      SELECT id, result_count, summary, title
      FROM saved_datasource_result_sets
      WHERE room_id IN (
        SELECT room_id
        FROM investigations
        WHERE id = $1
      )
        AND id = ANY($2::text[])
    `,
    [investigationId, ids],
  )

  return result.rows.map((row) => ({
    id: row.id,
    resultCount: row.result_count,
    summary: row.summary,
    title: row.title,
  }))
}

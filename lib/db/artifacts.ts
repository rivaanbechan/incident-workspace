import type {
  InvestigationArtifact,
  PersistedInvestigationArtifact,
} from "@/lib/contracts/artifacts"
import { createSchemaGuard, dbQuery, getDbPool } from "@/lib/db/index"
import { syncInvestigationEntityLinks, deleteInvestigationEntityLinksForTarget } from "@/lib/db/investigationEntities"
import { getInvestigationIdByRoom } from "@/lib/db/investigations"

const ensureArtifactSchema = createSchemaGuard(async () => {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS investigation_artifacts (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      source_module TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      artifact JSONB NOT NULL,
      persisted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await dbQuery(`
    CREATE INDEX IF NOT EXISTS investigation_artifacts_room_id_idx
    ON investigation_artifacts (room_id, persisted_at DESC)
  `)
})

function assertDatabase() {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }
}

function mapArtifactRow(row: {
  artifact: InvestigationArtifact
  persisted_at: string
  room_id: string
}): PersistedInvestigationArtifact {
  return {
    ...row.artifact,
    persistedAt: row.persisted_at,
    roomId: row.room_id,
  }
}

export async function listRoomArtifacts(roomId: string) {
  if (!getDbPool()) {
    return []
  }

  await ensureArtifactSchema()

  const result = await dbQuery<{
    artifact: InvestigationArtifact
    persisted_at: string
    room_id: string
  }>(
    `
      SELECT artifact, persisted_at::text, room_id
      FROM investigation_artifacts
      WHERE room_id = $1
      ORDER BY persisted_at DESC
    `,
    [roomId],
  )

  return result.rows.map(mapArtifactRow)
}

export async function createRoomArtifact(roomId: string, artifact: InvestigationArtifact) {
  assertDatabase()
  await ensureArtifactSchema()

  await dbQuery(
    `
      INSERT INTO investigation_artifacts (
        id,
        room_id,
        kind,
        source_module,
        title,
        summary,
        artifact,
        persisted_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET
        kind = EXCLUDED.kind,
        source_module = EXCLUDED.source_module,
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        artifact = EXCLUDED.artifact,
        persisted_at = NOW()
    `,
    [
      artifact.id,
      roomId,
      artifact.kind,
      artifact.sourceModule,
      artifact.title,
      artifact.summary,
      JSON.stringify(artifact),
    ],
  )

  const investigationId = await getInvestigationIdByRoom(roomId)

  if (investigationId) {
    await syncInvestigationEntityLinks(
      investigationId,
      "artifact",
      artifact.id,
      artifact.relatedEntities ?? [],
    )
  }

  const artifacts = await listRoomArtifacts(roomId)

  return artifacts.find((item) => item.id === artifact.id) ?? null
}

export async function deleteRoomArtifacts(roomId: string) {
  if (!getDbPool()) {
    return
  }

  await ensureArtifactSchema()

  const investigationId = await getInvestigationIdByRoom(roomId)
  const existingArtifacts =
    investigationId
      ? await dbQuery<{ id: string }>(
          `
            SELECT id
            FROM investigation_artifacts
            WHERE room_id = $1
          `,
          [roomId],
        )
      : null

  await dbQuery(
    `
      DELETE FROM investigation_artifacts
      WHERE room_id = $1
    `,
    [roomId],
  )

  if (investigationId && existingArtifacts) {
    for (const artifact of existingArtifacts.rows) {
      await deleteInvestigationEntityLinksForTarget(
        investigationId,
        "artifact",
        artifact.id,
      )
    }
  }
}

export async function listArtifactKindsByRoomIds(roomIds: string[]) {
  if (!getDbPool() || roomIds.length === 0) {
    return []
  }

  await ensureArtifactSchema()

  const result = await dbQuery<{ kind: string; room_id: string }>(
    `
      SELECT room_id, artifact->>'kind' AS kind
      FROM investigation_artifacts
      WHERE room_id = ANY($1::text[])
    `,
    [roomIds],
  )

  return result.rows
}

export async function getArtifactStubsByIds(investigationId: string, artifactIds: string[]) {
  if (!getDbPool() || artifactIds.length === 0) {
    return []
  }

  await ensureArtifactSchema()

  const result = await dbQuery<{
    artifact: {
      id: string
      kind: string
      summary: string
      title: string
    }
  }>(
    `
      SELECT artifact
      FROM investigation_artifacts
      WHERE room_id IN (
        SELECT room_id
        FROM investigations
        WHERE id = $1
      )
        AND id = ANY($2::text[])
    `,
    [investigationId, artifactIds],
  )

  return result.rows.map((row) => ({
    id: row.artifact.id,
    kind: row.artifact.kind,
    summary: row.artifact.summary,
    title: row.artifact.title,
  }))
}

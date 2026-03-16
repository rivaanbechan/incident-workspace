import type {
  Investigation,
  InvestigationActivity,
  InvestigationAggregateCounts,
  InvestigationOverview,
  InvestigationSeverity,
  InvestigationStatus,
} from "@/lib/contracts/investigations"
import { createSchemaGuard, dbQuery, generateId, getDbPool } from "@/lib/db/index"

export type InvestigationFilters = {
  archived?: "active" | "all" | "archived"
  owner?: string
  query?: string
  severity?: InvestigationSeverity | "all"
  state?: "all" | "closed" | "open"
  status?: InvestigationStatus | "all"
  updated?: "all" | "recent"
}

type CreateInvestigationInput = {
  owner: string
  severity: InvestigationSeverity
  source?: {
    externalId: string
    system: string
  }
  summary: string
  title: string
}

type UpdateInvestigationInput = {
  owner: string
  severity: InvestigationSeverity
  status: InvestigationStatus
  summary: string
  title: string
}

const ensureInvestigationSchema = createSchemaGuard(async () => {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS investigations (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL,
      severity TEXT NOT NULL,
      owner TEXT NOT NULL,
      source_system TEXT,
      source_external_id TEXT,
      archived_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await dbQuery(`
    ALTER TABLE investigations
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ
  `)

  await dbQuery(`
    ALTER TABLE investigations
    ADD COLUMN IF NOT EXISTS source_system TEXT
  `)

  await dbQuery(`
    ALTER TABLE investigations
    ADD COLUMN IF NOT EXISTS source_external_id TEXT
  `)

  await dbQuery(`
    CREATE INDEX IF NOT EXISTS investigations_status_idx
    ON investigations (status, updated_at DESC)
  `)

  await dbQuery(`
    CREATE INDEX IF NOT EXISTS investigations_owner_idx
    ON investigations (owner, updated_at DESC)
  `)

  await dbQuery(`
    CREATE UNIQUE INDEX IF NOT EXISTS investigations_source_reference_idx
    ON investigations (source_system, source_external_id)
    WHERE source_system IS NOT NULL AND source_external_id IS NOT NULL
  `)

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS investigation_activity (
      id TEXT PRIMARY KEY,
      investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await dbQuery(`
    CREATE INDEX IF NOT EXISTS investigation_activity_investigation_idx
    ON investigation_activity (investigation_id, created_at DESC)
  `)
})

function mapInvestigationRow(row: {
  archived_at: string | null
  created_at: string
  id: string
  owner: string
  room_id: string
  source_external_id: string | null
  source_system: string | null
  severity: InvestigationSeverity
  status: InvestigationStatus
  summary: string
  title: string
  updated_at: string
}): Investigation {
  return {
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    id: row.id,
    owner: row.owner,
    roomId: row.room_id,
    sourceExternalId: row.source_external_id,
    sourceSystem: row.source_system,
    severity: row.severity,
    status: row.status,
    summary: row.summary,
    title: row.title,
    updatedAt: row.updated_at,
  }
}

function mapActivityRow(row: {
  created_at: string
  id: string
  investigation_id: string
  kind: InvestigationActivity["kind"]
  summary: string
}): InvestigationActivity {
  return {
    createdAt: row.created_at,
    id: row.id,
    investigationId: row.investigation_id,
    kind: row.kind,
    summary: row.summary,
  }
}

function buildFilterQuery(filters: InvestigationFilters) {
  const clauses: string[] = []
  const values: unknown[] = []

  if (filters.query?.trim()) {
    values.push(`%${filters.query.trim()}%`)
    clauses.push(`(title ILIKE $${values.length} OR summary ILIKE $${values.length})`)
  }

  if (filters.status && filters.status !== "all") {
    values.push(filters.status)
    clauses.push(`status = $${values.length}`)
  }

  if (filters.severity && filters.severity !== "all") {
    values.push(filters.severity)
    clauses.push(`severity = $${values.length}`)
  }

  if (filters.owner?.trim()) {
    values.push(filters.owner.trim())
    clauses.push(`owner = $${values.length}`)
  }

  if (filters.state === "open") {
    clauses.push(`status <> 'closed'`)
  }

  if (filters.state === "closed") {
    clauses.push(`status = 'closed'`)
  }

  if (filters.updated === "recent") {
    clauses.push(`updated_at >= NOW() - INTERVAL '7 days'`)
  }

  if (!filters.archived || filters.archived === "active") {
    clauses.push(`archived_at IS NULL`)
  }

  if (filters.archived === "archived") {
    clauses.push(`archived_at IS NOT NULL`)
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  }
}

export async function logInvestigationActivity(
  investigationId: string,
  kind: InvestigationActivity["kind"],
  summary: string,
) {
  await dbQuery(
    `
      INSERT INTO investigation_activity (id, investigation_id, kind, summary, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `,
    [generateId("activity"), investigationId, kind, summary],
  )
}

export async function createInvestigation(input: CreateInvestigationInput) {
  await ensureInvestigationSchema()

  if (input.source?.system.trim() && input.source.externalId.trim()) {
    const existing = await findInvestigationBySourceReference(
      input.source.system,
      input.source.externalId,
    )

    if (existing) {
      return existing
    }
  }

  const id = generateId("case")
  const roomId = generateId("room")

  await dbQuery(
    `
      INSERT INTO investigations (
        id,
        room_id,
        title,
        summary,
        status,
        severity,
        owner,
        source_system,
        source_external_id,
        archived_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, 'open', $5, $6, $7, $8, NULL, NOW(), NOW())
    `,
    [
      id,
      roomId,
      input.title.trim(),
      input.summary.trim(),
      input.severity,
      input.owner.trim(),
      input.source?.system.trim() || null,
      input.source?.externalId.trim() || null,
    ],
  )

  await logInvestigationActivity(id, "case_created", `Case created and linked to room ${roomId}.`)

  return getInvestigationById(id)
}

export async function updateInvestigation(
  investigationId: string,
  input: UpdateInvestigationInput,
) {
  await ensureInvestigationSchema()

  await dbQuery(
    `
      UPDATE investigations
      SET
        title = $2,
        summary = $3,
        status = $4,
        severity = $5,
        owner = $6,
        updated_at = NOW()
      WHERE id = $1
    `,
    [
      investigationId,
      input.title.trim(),
      input.summary.trim(),
      input.status,
      input.severity,
      input.owner.trim(),
    ],
  )

  await logInvestigationActivity(investigationId, "metadata_updated", "Case metadata updated.")

  return getInvestigationById(investigationId)
}

export async function getInvestigationById(investigationId: string) {
  if (!getDbPool()) {
    return null
  }

  await ensureInvestigationSchema()

  const result = await dbQuery<{
    archived_at: string | null
    created_at: string
    id: string
    owner: string
    room_id: string
    source_external_id: string | null
    source_system: string | null
    severity: InvestigationSeverity
    status: InvestigationStatus
    summary: string
    title: string
    updated_at: string
  }>(
    `
      SELECT id, room_id, title, summary, status, severity, owner, source_system, source_external_id, archived_at::text, created_at::text, updated_at::text
      FROM investigations
      WHERE id = $1
      LIMIT 1
    `,
    [investigationId],
  )

  return result.rows[0] ? mapInvestigationRow(result.rows[0]) : null
}

export async function findInvestigationBySourceReference(
  sourceSystem: string,
  sourceExternalId: string,
) {
  if (!getDbPool()) {
    return null
  }

  await ensureInvestigationSchema()

  const result = await dbQuery<{
    archived_at: string | null
    created_at: string
    id: string
    owner: string
    room_id: string
    source_external_id: string | null
    source_system: string | null
    severity: InvestigationSeverity
    status: InvestigationStatus
    summary: string
    title: string
    updated_at: string
  }>(
    `
      SELECT id, room_id, title, summary, status, severity, owner, source_system, source_external_id, archived_at::text, created_at::text, updated_at::text
      FROM investigations
      WHERE source_system = $1 AND source_external_id = $2
      LIMIT 1
    `,
    [sourceSystem.trim(), sourceExternalId.trim()],
  )

  return result.rows[0] ? mapInvestigationRow(result.rows[0]) : null
}

export async function getInvestigationIdByRoom(roomId: string) {
  if (!getDbPool()) {
    return null
  }

  await ensureInvestigationSchema()

  const result = await dbQuery<{ id: string }>(
    `
      SELECT id
      FROM investigations
      WHERE room_id = $1
      LIMIT 1
    `,
    [roomId],
  )

  return result.rows[0]?.id ?? null
}

export async function getInvestigationByRoomId(roomId: string) {
  if (!getDbPool()) {
    return null
  }

  await ensureInvestigationSchema()

  const result = await dbQuery<{
    archived_at: string | null
    created_at: string
    id: string
    owner: string
    room_id: string
    source_external_id: string | null
    source_system: string | null
    severity: InvestigationSeverity
    status: InvestigationStatus
    summary: string
    title: string
    updated_at: string
  }>(
    `
      SELECT id, room_id, title, summary, status, severity, owner, source_system, source_external_id, archived_at::text, created_at::text, updated_at::text
      FROM investigations
      WHERE room_id = $1
      LIMIT 1
    `,
    [roomId],
  )

  return result.rows[0] ? mapInvestigationRow(result.rows[0]) : null
}

export async function listInvestigationRows(filters: InvestigationFilters = {}) {
  if (!getDbPool()) {
    return []
  }

  await ensureInvestigationSchema()

  const { sql, values } = buildFilterQuery(filters)
  const result = await dbQuery<{
    archived_at: string | null
    created_at: string
    id: string
    owner: string
    room_id: string
    source_external_id: string | null
    source_system: string | null
    severity: InvestigationSeverity
    status: InvestigationStatus
    summary: string
    title: string
    updated_at: string
  }>(
    `
      SELECT id, room_id, title, summary, status, severity, owner, source_system, source_external_id, archived_at::text, created_at::text, updated_at::text
      FROM investigations
      ${sql}
      ORDER BY updated_at DESC
    `,
    values,
  )

  return result.rows.map(mapInvestigationRow)
}

export async function listInvestigationActivityCountsByIds(investigationIds: string[]) {
  if (!getDbPool() || investigationIds.length === 0) {
    return new Map<string, number>()
  }

  await ensureInvestigationSchema()

  const result = await dbQuery<{
    activity_count: number
    investigation_id: string
  }>(
    `
      SELECT
        investigation_id,
        COUNT(*)::int AS activity_count
      FROM investigation_activity
      WHERE investigation_id = ANY($1::text[])
      GROUP BY investigation_id
    `,
    [investigationIds],
  )

  return new Map(result.rows.map((row) => [row.investigation_id, row.activity_count] as const))
}

export async function listInvestigationActivity(investigationId: string) {
  if (!getDbPool()) {
    return []
  }

  await ensureInvestigationSchema()

  const result = await dbQuery<{
    created_at: string
    id: string
    investigation_id: string
    kind: InvestigationActivity["kind"]
    summary: string
  }>(
    `
      SELECT id, investigation_id, kind, summary, created_at::text
      FROM investigation_activity
      WHERE investigation_id = $1
      ORDER BY created_at DESC
      LIMIT 12
    `,
    [investigationId],
  )

  return result.rows.map(mapActivityRow)
}

export async function archiveInvestigation(investigationId: string) {
  await ensureInvestigationSchema()

  const investigation = await getInvestigationById(investigationId)

  if (!investigation || investigation.archivedAt) {
    return investigation
  }

  await dbQuery(
    `
      UPDATE investigations
      SET archived_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `,
    [investigationId],
  )

  await logInvestigationActivity(investigationId, "archived", "Case archived.")

  return getInvestigationById(investigationId)
}

export async function restoreInvestigation(investigationId: string) {
  await ensureInvestigationSchema()

  const investigation = await getInvestigationById(investigationId)

  if (!investigation || !investigation.archivedAt) {
    return investigation
  }

  await dbQuery(
    `
      UPDATE investigations
      SET archived_at = NULL, updated_at = NOW()
      WHERE id = $1
    `,
    [investigationId],
  )

  await logInvestigationActivity(investigationId, "restored", "Case restored.")

  return getInvestigationById(investigationId)
}

export async function deleteInvestigationActivity(investigationId: string) {
  if (!getDbPool()) {
    return
  }

  await ensureInvestigationSchema()

  await dbQuery(
    `
      DELETE FROM investigation_activity
      WHERE investigation_id = $1
    `,
    [investigationId],
  )
}

export async function deleteInvestigationRecord(investigationId: string) {
  if (!getDbPool()) {
    return
  }

  await ensureInvestigationSchema()

  await dbQuery(
    `
      DELETE FROM investigations
      WHERE id = $1
    `,
    [investigationId],
  )
}

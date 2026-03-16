import type {
  InvestigationCaseRecord,
  InvestigationCaseRecordKind,
  InvestigationCaseRecordPayload,
  InvestigationCaseRecordSourceType,
} from "@/lib/contracts/caseRecords"
import type { ModuleDeepLink } from "@/lib/contracts/deepLinks"
import type { EntityRef } from "@/lib/contracts/entities"
import { createSchemaGuard, dbQuery, getDbPool } from "@/lib/db/index"
import {
  deleteInvestigationEntitiesForCaseRecord,
  syncCaseRecordEntities,
} from "@/lib/db/investigationEntities"


type CaseRecordRow = {
  created_at: string
  deep_link: ModuleDeepLink | null
  id: string
  investigation_id: string
  kind: InvestigationCaseRecordKind
  payload: InvestigationCaseRecordPayload
  related_entities: EntityRef[]
  source_id: string
  source_module: string
  source_room_id: string
  source_type: InvestigationCaseRecordSourceType
  summary: string
  title: string
  updated_at: string
}

export type CreateInvestigationCaseRecordInput = {
  deepLink?: ModuleDeepLink
  investigationId: string
  kind: InvestigationCaseRecordKind
  payload?: InvestigationCaseRecordPayload
  relatedEntities?: EntityRef[]
  sourceId: string
  sourceModule: string
  sourceRoomId: string
  sourceType: InvestigationCaseRecordSourceType
  summary: string
  title: string
}

export type UpdateInvestigationCaseRecordInput = {
  deepLink?: ModuleDeepLink
  kind: InvestigationCaseRecordKind
  payload?: InvestigationCaseRecordPayload
  relatedEntities?: EntityRef[]
  summary: string
  title: string
}

export type UpsertInvestigationCaseRecordInput = CreateInvestigationCaseRecordInput

function createCaseRecordId(
  investigationId: string,
  sourceType: InvestigationCaseRecordSourceType,
  sourceId: string,
) {
  return `${investigationId}:${sourceType}:${sourceId}`
}

const ensureCaseRecordSchema = createSchemaGuard(async () => {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS investigation_case_records (
      id TEXT PRIMARY KEY,
      investigation_id TEXT NOT NULL,
      source_room_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      source_module TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      related_entities JSONB NOT NULL,
      deep_link JSONB,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await dbQuery(`
    CREATE INDEX IF NOT EXISTS investigation_case_records_investigation_idx
    ON investigation_case_records (investigation_id, updated_at DESC)
  `)
})

function mapCaseRecordRow(row: CaseRecordRow): InvestigationCaseRecord {
  return {
    createdAt: row.created_at,
    deepLink: row.deep_link ?? undefined,
    id: row.id,
    investigationId: row.investigation_id,
    kind: row.kind,
    payload: row.payload ?? {},
    relatedEntities: row.related_entities ?? [],
    sourceId: row.source_id,
    sourceModule: row.source_module,
    sourceRoomId: row.source_room_id,
    sourceType: row.source_type,
    summary: row.summary,
    title: row.title,
    updatedAt: row.updated_at,
  }
}

function normalizeCaseRecordPayload(payload?: InvestigationCaseRecordPayload) {
  return {
    ...payload,
    linkedArtifactIds: Array.isArray(payload?.linkedArtifactIds)
      ? payload?.linkedArtifactIds.filter((value): value is string => typeof value === "string")
      : [],
    linkedEvidenceSetIds: Array.isArray(payload?.linkedEvidenceSetIds)
      ? payload?.linkedEvidenceSetIds.filter((value): value is string => typeof value === "string")
      : [],
  } satisfies InvestigationCaseRecordPayload
}

export async function getInvestigationCaseRecord(
  investigationId: string,
  recordId: string,
) {
  if (!getDbPool()) {
    return null
  }

  await ensureCaseRecordSchema()

  const result = await dbQuery<CaseRecordRow>(
    `
      SELECT
        id,
        investigation_id,
        source_room_id,
        source_type,
        source_id,
        kind,
        source_module,
        title,
        summary,
        related_entities,
        deep_link,
        payload,
        created_at::text,
        updated_at::text
      FROM investigation_case_records
      WHERE investigation_id = $1 AND id = $2
    `,
    [investigationId, recordId],
  )

  return result.rows[0] ? mapCaseRecordRow(result.rows[0]) : null
}

export async function listInvestigationCaseRecords(investigationId: string) {
  if (!getDbPool()) {
    return []
  }

  await ensureCaseRecordSchema()

  const result = await dbQuery<CaseRecordRow>(
    `
      SELECT
        id,
        investigation_id,
        source_room_id,
        source_type,
        source_id,
        kind,
        source_module,
        title,
        summary,
        related_entities,
        deep_link,
        payload,
        created_at::text,
        updated_at::text
      FROM investigation_case_records
      WHERE investigation_id = $1
      ORDER BY updated_at DESC
    `,
    [investigationId],
  )

  return result.rows.map(mapCaseRecordRow)
}

export async function listInvestigationCaseRecordsByInvestigationIds(
  investigationIds: string[],
) {
  if (!getDbPool() || investigationIds.length === 0) {
    return new Map<string, InvestigationCaseRecord[]>()
  }

  await ensureCaseRecordSchema()

  const result = await dbQuery<CaseRecordRow>(
    `
      SELECT
        id,
        investigation_id,
        source_room_id,
        source_type,
        source_id,
        kind,
        source_module,
        title,
        summary,
        related_entities,
        deep_link,
        payload,
        created_at::text,
        updated_at::text
      FROM investigation_case_records
      WHERE investigation_id = ANY($1::text[])
      ORDER BY updated_at DESC
    `,
    [investigationIds],
  )

  const map = new Map<string, InvestigationCaseRecord[]>()

  for (const row of result.rows) {
    const record = mapCaseRecordRow(row)
    const existing = map.get(record.investigationId) ?? []
    existing.push(record)
    map.set(record.investigationId, existing)
  }

  return map
}

export async function createInvestigationCaseRecord(
  input: CreateInvestigationCaseRecordInput,
) {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureCaseRecordSchema()

  const payload = normalizeCaseRecordPayload(input.payload)
  const id =
    input.sourceType === "case-record"
      ? createCaseRecordId(input.investigationId, input.sourceType, input.sourceId)
      : createCaseRecordId(input.investigationId, input.sourceType, input.sourceId)

  const result = await dbQuery<CaseRecordRow>(
    `
      INSERT INTO investigation_case_records (
        id,
        investigation_id,
        source_room_id,
        source_type,
        source_id,
        kind,
        source_module,
        title,
        summary,
        related_entities,
        deep_link,
        payload,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, NOW(), NOW()
      )
      RETURNING
        id,
        investigation_id,
        source_room_id,
        source_type,
        source_id,
        kind,
        source_module,
        title,
        summary,
        related_entities,
        deep_link,
        payload,
        created_at::text,
        updated_at::text
    `,
    [
      id,
      input.investigationId,
      input.sourceRoomId,
      input.sourceType,
      input.sourceId,
      input.kind,
      input.sourceModule,
      input.title,
      input.summary,
      JSON.stringify(input.relatedEntities ?? []),
      JSON.stringify(input.deepLink ?? null),
      JSON.stringify(payload),
    ],
  )

  await syncCaseRecordEntities(input.investigationId, id, input.relatedEntities ?? [])

  return mapCaseRecordRow(result.rows[0])
}

export async function updateInvestigationCaseRecord(
  investigationId: string,
  recordId: string,
  input: UpdateInvestigationCaseRecordInput,
) {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureCaseRecordSchema()

  const payload = normalizeCaseRecordPayload(input.payload)
  const result = await dbQuery<CaseRecordRow>(
    `
      UPDATE investigation_case_records
      SET
        kind = $3,
        title = $4,
        summary = $5,
        related_entities = $6::jsonb,
        deep_link = $7::jsonb,
        payload = $8::jsonb,
        updated_at = NOW()
      WHERE investigation_id = $1 AND id = $2
      RETURNING
        id,
        investigation_id,
        source_room_id,
        source_type,
        source_id,
        kind,
        source_module,
        title,
        summary,
        related_entities,
        deep_link,
        payload,
        created_at::text,
        updated_at::text
    `,
    [
      investigationId,
      recordId,
      input.kind,
      input.title,
      input.summary,
      JSON.stringify(input.relatedEntities ?? []),
      JSON.stringify(input.deepLink ?? null),
      JSON.stringify(payload),
    ],
  )

  if (!result.rows[0]) {
    throw new Error("Case record not found.")
  }

  await syncCaseRecordEntities(investigationId, recordId, input.relatedEntities ?? [])

  return mapCaseRecordRow(result.rows[0])
}

export async function upsertInvestigationCaseRecord(
  input: UpsertInvestigationCaseRecordInput,
) {
  const existing = await getInvestigationCaseRecord(
    input.investigationId,
    createCaseRecordId(input.investigationId, input.sourceType, input.sourceId),
  )

  if (existing) {
    return updateInvestigationCaseRecord(input.investigationId, existing.id, {
      deepLink: input.deepLink,
      kind: input.kind,
      payload: input.payload,
      relatedEntities: input.relatedEntities,
      summary: input.summary,
      title: input.title,
    })
  }

  return createInvestigationCaseRecord(input)
}

export async function deleteInvestigationCaseRecord(
  investigationId: string,
  recordId: string,
) {
  if (!getDbPool()) {
    return
  }

  await ensureCaseRecordSchema()
  await deleteInvestigationEntitiesForCaseRecord(investigationId, recordId)

  await dbQuery(
    `
      DELETE FROM investigation_case_records
      WHERE investigation_id = $1 AND id = $2
    `,
    [investigationId, recordId],
  )
}

export async function deleteInvestigationCaseRecords(investigationId: string) {
  if (!getDbPool()) {
    return
  }

  await ensureCaseRecordSchema()

  const records = await listInvestigationCaseRecords(investigationId)
  for (const record of records) {
    await deleteInvestigationEntitiesForCaseRecord(investigationId, record.id)
  }

  await dbQuery(
    `
      DELETE FROM investigation_case_records
      WHERE investigation_id = $1
    `,
    [investigationId],
  )
}

export async function listCaseRecordKindsByInvestigation(investigationId: string) {
  if (!getDbPool()) {
    return []
  }

  await ensureCaseRecordSchema()

  const result = await dbQuery<{
    id: string
    kind: InvestigationCaseRecordKind
    payload: InvestigationCaseRecordPayload
  }>(
    `
      SELECT id, kind, payload
      FROM investigation_case_records
      WHERE investigation_id = $1
    `,
    [investigationId],
  )

  return result.rows
}

export async function getCaseRecordStubsByIds(investigationId: string, ids: string[]) {
  if (!getDbPool() || ids.length === 0) {
    return []
  }

  await ensureCaseRecordSchema()

  const result = await dbQuery<{
    id: string
    kind: InvestigationCaseRecordKind
    summary: string
    title: string
    updated_at: string
  }>(
    `
      SELECT id, kind, summary, title, updated_at::text
      FROM investigation_case_records
      WHERE investigation_id = $1
        AND id = ANY($2::text[])
      ORDER BY updated_at DESC
    `,
    [investigationId, ids],
  )

  return result.rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    summary: row.summary,
    title: row.title,
    updatedAt: row.updated_at,
  }))
}

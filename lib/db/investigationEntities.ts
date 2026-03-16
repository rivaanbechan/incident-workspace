import type { EntityRef } from "@/lib/contracts/entities"
import type { EntityKind } from "@/lib/contracts/entities"
import type {
  InvestigationEntityDetail,
  InvestigationEntity,
  InvestigationEntityKind,
  InvestigationEntityLinkTargetKind,
  InvestigationEntitySummary,
} from "@/lib/contracts/investigationEntities"
import { getArtifactStubsByIds } from "@/lib/db/artifacts"
import { getCaseRecordStubsByIds, listCaseRecordKindsByInvestigation } from "@/lib/db/caseRecords"
import { getEvidenceSetStubsByIds } from "@/lib/db/datasourceResults"
import { createSchemaGuard, dbQuery, getDbPool } from "@/lib/db/index"
import type { InvestigationCaseRecordKind } from "@/lib/contracts/caseRecords"


type InvestigationEntityRow = {
  created_at: string
  id: string
  investigation_id: string
  kind: InvestigationEntityKind
  label: string
  payload: Record<string, unknown>
  updated_at: string
  value: string
}

type InvestigationEntityLinkRow = {
  entity_id: string
  target_id: string
  target_kind: InvestigationEntityLinkTargetKind
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase()
}

function toInvestigationEntityKind(kind: EntityKind): InvestigationEntityKind {
  return kind === "domain" ||
    kind === "identity" ||
    kind === "ip" ||
    kind === "process" ||
    kind === "service" ||
    kind === "url" ||
    kind === "file" ||
    kind === "host"
    ? kind
    : kind === "user"
      ? "identity"
      : "other"
}

function summarizeCaseRecords(
  records: Array<{
    kind: InvestigationCaseRecordKind
    payload: Record<string, unknown>
  }>,
) {
  let decisionCount = 0
  let findingCount = 0
  let hypothesisCount = 0
  let openActionCount = 0

  for (const record of records) {
    const kind = record.kind

    if (kind === "decision") {
      decisionCount += 1
    }

    if (kind === "finding") {
      findingCount += 1
    }

    if (kind === "hypothesis") {
      hypothesisCount += 1
    }

    if (kind === "action" && record.payload.status !== "done") {
      openActionCount += 1
    }
  }

  return {
    decisionCount,
    findingCount,
    hypothesisCount,
    openActionCount,
  }
}

export function entityRefToInvestigationEntityInput(entityRef: EntityRef) {
  return {
    kind: toInvestigationEntityKind(entityRef.kind),
    label: entityRef.label,
    value: entityRef.id,
  }
}

async function createEntityLink(
  investigationId: string,
  entityId: string,
  targetKind: InvestigationEntityLinkTargetKind,
  targetId: string,
) {
  await dbQuery(
    `
      INSERT INTO investigation_entity_links (
        investigation_id,
        entity_id,
        target_kind,
        target_id,
        created_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (entity_id, target_kind, target_id) DO NOTHING
    `,
    [investigationId, entityId, targetKind, targetId],
  )
}

export async function linkInvestigationEntity(
  investigationId: string,
  entityId: string,
  targetKind: InvestigationEntityLinkTargetKind,
  targetId: string,
) {
  if (!getDbPool()) {
    return
  }

  await ensureInvestigationEntitySchema()
  await createEntityLink(investigationId, entityId, targetKind, targetId)
}

export async function unlinkInvestigationEntity(
  investigationId: string,
  entityId: string,
  targetKind: InvestigationEntityLinkTargetKind,
  targetId: string,
) {
  if (!getDbPool()) {
    return
  }

  await ensureInvestigationEntitySchema()

  await dbQuery(
    `
      DELETE FROM investigation_entity_links
      WHERE investigation_id = $1
        AND entity_id = $2
        AND target_kind = $3
        AND target_id = $4
    `,
    [investigationId, entityId, targetKind, targetId],
  )
}

export async function syncInvestigationEntityLinks(
  investigationId: string,
  targetKind: InvestigationEntityLinkTargetKind,
  targetId: string,
  entityRefs: EntityRef[],
) {
  if (!getDbPool()) {
    return []
  }

  await ensureInvestigationEntitySchema()

  const linkedEntityIds: string[] = []

  for (const entityRef of entityRefs) {
    const entity = await upsertInvestigationEntity(
      investigationId,
      entityRefToInvestigationEntityInput(entityRef),
    )

    linkedEntityIds.push(entity.id)
    await createEntityLink(investigationId, entity.id, targetKind, targetId)
  }

  await dbQuery(
    `
      DELETE FROM investigation_entity_links
      WHERE investigation_id = $1
        AND target_kind = $2
        AND target_id = $3
        AND NOT (entity_id = ANY($4::text[]))
    `,
    [investigationId, targetKind, targetId, linkedEntityIds.length > 0 ? linkedEntityIds : ["__none__"]],
  )

  return linkedEntityIds
}

export async function listInvestigationEntitySummaries(
  investigationId: string,
) {
  if (!getDbPool()) {
    return []
  }

  await ensureInvestigationEntitySchema()

  const [entities, linksResult, caseRecordKinds] = await Promise.all([
    listInvestigationEntities(investigationId),
    dbQuery<InvestigationEntityLinkRow>(
      `
        SELECT entity_id, target_kind, target_id
        FROM investigation_entity_links
        WHERE investigation_id = $1
      `,
      [investigationId],
    ),
    listCaseRecordKindsByInvestigation(investigationId),
  ])

  const caseRecordMap = new Map(
    caseRecordKinds.map((row) => [row.id, row] as const),
  )
  const links = linksResult.rows
  const linkMap = new Map<string, InvestigationEntityLinkRow[]>()

  for (const link of links) {
    const current = linkMap.get(link.entity_id) ?? []
    current.push(link)
    linkMap.set(link.entity_id, current)
  }

  return entities.map((entity) => {
    const entityLinks = linkMap.get(entity.id) ?? []
    const caseRecordsForEntity = entityLinks
      .filter((link) => link.target_kind === "case-record")
      .map((link) => caseRecordMap.get(link.target_id))
      .filter(
        (
          record,
        ): record is {
          id: string
          kind: InvestigationCaseRecordKind
          payload: Record<string, unknown>
        } => Boolean(record),
      )
    const kindSummary = summarizeCaseRecords(caseRecordsForEntity)

    return {
      ...entity,
      artifactCount: entityLinks.filter((link) => link.target_kind === "artifact").length,
      caseRecordCount: entityLinks.filter((link) => link.target_kind === "case-record").length,
      decisionCount: kindSummary.decisionCount,
      evidenceSetCount: entityLinks.filter((link) => link.target_kind === "evidence-set").length,
      findingCount: kindSummary.findingCount,
      hypothesisCount: kindSummary.hypothesisCount,
      openActionCount: kindSummary.openActionCount,
    } satisfies InvestigationEntitySummary
  })
}

export async function getInvestigationEntityDetail(
  investigationId: string,
  entityId: string,
) {
  if (!getDbPool()) {
    return null
  }

  await ensureInvestigationEntitySchema()

  const [summary] = (await listInvestigationEntitySummaries(investigationId)).filter(
    (entity) => entity.id === entityId,
  )

  if (!summary) {
    return null
  }

  const linksResult = await dbQuery<InvestigationEntityLinkRow>(
    `
      SELECT target_kind, target_id
      FROM investigation_entity_links
      WHERE investigation_id = $1
        AND entity_id = $2
      ORDER BY created_at DESC
    `,
    [investigationId, entityId],
  )

  const links = linksResult.rows
  const caseRecordIds = links
    .filter((link) => link.target_kind === "case-record")
    .map((link) => link.target_id)
  const artifactIds = links
    .filter((link) => link.target_kind === "artifact")
    .map((link) => link.target_id)
  const evidenceSetIds = links
    .filter((link) => link.target_kind === "evidence-set")
    .map((link) => link.target_id)

  const [caseRecords, artifacts, evidenceSets] = await Promise.all([
    getCaseRecordStubsByIds(investigationId, caseRecordIds),
    getArtifactStubsByIds(investigationId, artifactIds),
    getEvidenceSetStubsByIds(investigationId, evidenceSetIds),
  ])

  return {
    ...summary,
    artifacts,
    caseRecords,
    evidenceSets,
    links: links.map((link) => ({
      targetId: link.target_id,
      targetKind: link.target_kind,
    })),
  } satisfies InvestigationEntityDetail
}

const ensureInvestigationEntitySchema = createSchemaGuard(async () => {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS investigation_entities (
      id TEXT PRIMARY KEY,
      investigation_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      value TEXT NOT NULL,
      normalized_value TEXT NOT NULL,
      label TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (investigation_id, kind, normalized_value)
    )
  `)

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS investigation_entity_links (
      investigation_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      target_kind TEXT NOT NULL,
      target_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (entity_id, target_kind, target_id)
    )
  `)

  await dbQuery(`
    CREATE INDEX IF NOT EXISTS investigation_entities_investigation_idx
    ON investigation_entities (investigation_id, updated_at DESC)
  `)
})

function mapRow(row: InvestigationEntityRow): InvestigationEntity {
  return {
    createdAt: row.created_at,
    id: row.id,
    investigationId: row.investigation_id,
    kind: row.kind,
    label: row.label,
    payload: row.payload ?? {},
    updatedAt: row.updated_at,
    value: row.value,
  }
}

function createEntityId(investigationId: string, kind: string, value: string) {
  return `${investigationId}:${kind}:${normalizeValue(value)}`
}

export async function upsertInvestigationEntity(
  investigationId: string,
  input: {
    kind: InvestigationEntityKind
    label: string
    payload?: Record<string, unknown>
    value: string
  },
) {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureInvestigationEntitySchema()

  const id = createEntityId(investigationId, input.kind, input.value)
  const result = await dbQuery<InvestigationEntityRow>(
    `
      INSERT INTO investigation_entities (
        id,
        investigation_id,
        kind,
        value,
        normalized_value,
        label,
        payload,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW(), NOW())
      ON CONFLICT (investigation_id, kind, normalized_value) DO UPDATE SET
        label = EXCLUDED.label,
        payload = EXCLUDED.payload,
        updated_at = NOW()
      RETURNING
        id,
        investigation_id,
        kind,
        value,
        label,
        payload,
        created_at::text,
        updated_at::text
    `,
    [
      id,
      investigationId,
      input.kind,
      input.value.trim(),
      normalizeValue(input.value),
      input.label.trim() || input.value.trim(),
      JSON.stringify(input.payload ?? {}),
    ],
  )

  return mapRow(result.rows[0])
}

export async function syncCaseRecordEntities(
  investigationId: string,
  targetId: string,
  entityRefs: EntityRef[],
) {
  return syncInvestigationEntityLinks(investigationId, "case-record", targetId, entityRefs)
}

export async function listInvestigationEntities(investigationId: string) {
  if (!getDbPool()) {
    return []
  }

  await ensureInvestigationEntitySchema()

  const result = await dbQuery<InvestigationEntityRow>(
    `
      SELECT
        id,
        investigation_id,
        kind,
        value,
        label,
        payload,
        created_at::text,
        updated_at::text
      FROM investigation_entities
      WHERE investigation_id = $1
      ORDER BY updated_at DESC
    `,
    [investigationId],
  )

  return result.rows.map(mapRow)
}

export async function listInvestigationEntitiesByInvestigationIds(
  investigationIds: string[],
) {
  if (!getDbPool() || investigationIds.length === 0) {
    return new Map<string, InvestigationEntity[]>()
  }

  await ensureInvestigationEntitySchema()

  const result = await dbQuery<InvestigationEntityRow>(
    `
      SELECT
        id,
        investigation_id,
        kind,
        value,
        label,
        payload,
        created_at::text,
        updated_at::text
      FROM investigation_entities
      WHERE investigation_id = ANY($1::text[])
      ORDER BY updated_at DESC
    `,
    [investigationIds],
  )

  const map = new Map<string, InvestigationEntity[]>()

  for (const row of result.rows) {
    const entity = mapRow(row)
    const current = map.get(entity.investigationId) ?? []
    current.push(entity)
    map.set(entity.investigationId, current)
  }

  return map
}

export async function deleteInvestigationEntitiesForCaseRecord(
  investigationId: string,
  recordId: string,
) {
  return deleteInvestigationEntityLinksForTarget(investigationId, "case-record", recordId)
}

export async function deleteInvestigationEntityLinksForTarget(
  investigationId: string,
  targetKind: InvestigationEntityLinkTargetKind,
  targetId: string,
) {
  if (!getDbPool()) {
    return
  }

  await ensureInvestigationEntitySchema()

  await dbQuery(
    `
      DELETE FROM investigation_entity_links
      WHERE investigation_id = $1
        AND target_kind = $2
        AND target_id = $3
    `,
    [investigationId, targetKind, targetId],
  )
}

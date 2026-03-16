import { createSchemaGuard, dbQuery, getDbPool } from "@/lib/db/index"
import type {
  DatasourceConfigurationInput,
  DatasourceConfigPayload,
  DatasourceInstallation,
  StoredDatasourceInstallation,
} from "@/lib/datasources/types"

type DatasourceRow = {
  auth_config: DatasourceConfigPayload
  base_url: string
  created_at: string
  enabled: boolean
  id: string
  title: string
  updated_at: string
  vendor: StoredDatasourceInstallation["vendor"]
}

const ensureDatasourceSchema = createSchemaGuard(async () => {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS platform_datasources (
      id TEXT PRIMARY KEY,
      vendor TEXT NOT NULL,
      title TEXT NOT NULL,
      base_url TEXT NOT NULL,
      auth_config JSONB NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
})

function mapStoredDatasource(row: DatasourceRow): StoredDatasourceInstallation {
  return {
    baseUrl: row.base_url,
    config: row.auth_config,
    createdAt: row.created_at,
    enabled: row.enabled,
    id: row.id,
    skipTlsVerify: row.auth_config.skipTlsVerify === true,
    title: row.title,
    updatedAt: row.updated_at,
    vendor: row.vendor,
  }
}

function toPublicDatasource(row: StoredDatasourceInstallation): DatasourceInstallation {
  return {
    baseUrl: row.baseUrl,
    createdAt: row.createdAt,
    enabled: row.enabled,
    id: row.id,
    skipTlsVerify: row.skipTlsVerify,
    title: row.title,
    updatedAt: row.updatedAt,
    vendor: row.vendor,
  }
}

export async function listDatasources() {
  if (!getDbPool()) {
    return []
  }

  await ensureDatasourceSchema()

  const result = await dbQuery<DatasourceRow>(
    `
      SELECT
        id,
        vendor,
        title,
        base_url,
        auth_config,
        enabled,
        created_at::text,
        updated_at::text
      FROM platform_datasources
      ORDER BY title ASC
    `,
  )

  return result.rows.map((row) => toPublicDatasource(mapStoredDatasource(row)))
}

export async function getStoredDatasourceById(datasourceId: string) {
  if (!getDbPool()) {
    return null
  }

  await ensureDatasourceSchema()

  const result = await dbQuery<DatasourceRow>(
    `
      SELECT
        id,
        vendor,
        title,
        base_url,
        auth_config,
        enabled,
        created_at::text,
        updated_at::text
      FROM platform_datasources
      WHERE id = $1
    `,
    [datasourceId],
  )

  const row = result.rows[0]

  return row ? mapStoredDatasource(row) : null
}

export async function upsertDatasource(input: DatasourceConfigurationInput) {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureDatasourceSchema()

  const datasourceId = input.id?.trim() || input.vendor

  const result = await dbQuery<DatasourceRow>(
    `
      INSERT INTO platform_datasources (
        id,
        vendor,
        title,
        base_url,
        auth_config,
        enabled,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        vendor = EXCLUDED.vendor,
        title = EXCLUDED.title,
        base_url = EXCLUDED.base_url,
        auth_config = EXCLUDED.auth_config,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
      RETURNING
        id,
        vendor,
        title,
        base_url,
        auth_config,
        enabled,
        created_at::text,
        updated_at::text
    `,
    [
      datasourceId,
      input.vendor,
      input.title.trim(),
      input.baseUrl.trim(),
      JSON.stringify(input.config),
      input.enabled ?? true,
    ],
  )

  return toPublicDatasource(mapStoredDatasource(result.rows[0]))
}

export async function setDatasourceEnabled(datasourceId: string, enabled: boolean) {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureDatasourceSchema()

  const result = await dbQuery<DatasourceRow>(
    `
      UPDATE platform_datasources
      SET enabled = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        vendor,
        title,
        base_url,
        auth_config,
        enabled,
        created_at::text,
        updated_at::text
    `,
    [datasourceId, enabled],
  )

  const row = result.rows[0]

  return row ? toPublicDatasource(mapStoredDatasource(row)) : null
}

export async function deleteDatasource(datasourceId: string) {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureDatasourceSchema()

  const result = await dbQuery<{ id: string }>(
    `
      DELETE FROM platform_datasources
      WHERE id = $1
      RETURNING id
    `,
    [datasourceId],
  )

  return result.rows[0]?.id ?? null
}

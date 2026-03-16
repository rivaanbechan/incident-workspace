import type { AppModuleManifest } from "@/lib/modules/types"

import { createSchemaGuard, dbQuery, getDbPool, isDatabaseConfigured } from "@/lib/db/index"

export type DatabaseHealth = {
  connected: boolean
  currentDatabase: string | null
  currentTime: string | null
  error: string | null
  configured: boolean
}

export type PersistedModuleRecord = {
  defaultHref: string
  description: string
  id: string
  routeCount: number
  title: string
}

export type PlatformOverview = {
  database: DatabaseHealth
  modules: PersistedModuleRecord[]
}

const ensurePlatformSchema = createSchemaGuard(async () => {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS platform_modules (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      default_href TEXT NOT NULL,
      route_count INTEGER NOT NULL DEFAULT 0,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS platform_module_routes (
      module_id TEXT NOT NULL REFERENCES platform_modules(id) ON DELETE CASCADE,
      href TEXT NOT NULL,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      PRIMARY KEY (module_id, href)
    )
  `)
})

export async function getDatabaseHealth(): Promise<DatabaseHealth> {
  if (!isDatabaseConfigured()) {
    return {
      configured: false,
      connected: false,
      currentDatabase: null,
      currentTime: null,
      error: null,
    }
  }

  try {
    const result = await dbQuery<{
      current_database: string
      current_time: string
    }>(
      "SELECT current_database() AS current_database, NOW()::text AS current_time",
    )

    return {
      configured: true,
      connected: true,
      currentDatabase: result.rows[0]?.current_database ?? null,
      currentTime: result.rows[0]?.current_time ?? null,
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      connected: false,
      currentDatabase: null,
      currentTime: null,
      error: error instanceof Error ? error.message : "Unknown database error.",
    }
  }
}

export async function syncModuleRegistry(modules: AppModuleManifest[]) {
  if (!getDbPool()) {
    return
  }

  await ensurePlatformSchema()

  const client = await getDbPool()!.connect()

  try {
    await client.query("BEGIN")

    const moduleIds = modules.map((module) => module.id)

    if (moduleIds.length > 0) {
      await client.query(
        "DELETE FROM platform_module_routes WHERE module_id = ANY($1::text[])",
        [moduleIds],
      )

      await client.query(
        "DELETE FROM platform_modules WHERE id <> ALL($1::text[])",
        [moduleIds],
      )
    }

    for (const registeredModule of modules) {
      await client.query(
        `
          INSERT INTO platform_modules (
            id,
            title,
            description,
            default_href,
            route_count,
            synced_at
          )
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            default_href = EXCLUDED.default_href,
            route_count = EXCLUDED.route_count,
            synced_at = NOW()
        `,
        [
          registeredModule.id,
          registeredModule.title,
          registeredModule.description,
          registeredModule.defaultHref,
          registeredModule.routes.length,
        ],
      )

      for (const [index, route] of registeredModule.routes.entries()) {
        await client.query(
          `
            INSERT INTO platform_module_routes (module_id, href, label, sort_order)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (module_id, href) DO UPDATE SET
              label = EXCLUDED.label,
              sort_order = EXCLUDED.sort_order
          `,
          [registeredModule.id, route.href, route.label, index],
        )
      }
    }

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function getPlatformOverview(
  modules: AppModuleManifest[],
): Promise<PlatformOverview> {
  const database = await getDatabaseHealth()

  if (!database.connected) {
    return {
      database,
      modules: [],
    }
  }

  await syncModuleRegistry(modules)

  const result = await dbQuery<{
    default_href: string
    description: string
    id: string
    route_count: number
    title: string
  }>(
    `
      SELECT
        id,
        title,
        description,
        default_href,
        route_count
      FROM platform_modules
      ORDER BY title ASC
    `,
  )

  return {
    database,
    modules: result.rows.map((row) => ({
      defaultHref: row.default_href,
      description: row.description,
      id: row.id,
      routeCount: row.route_count,
      title: row.title,
    })),
  }
}

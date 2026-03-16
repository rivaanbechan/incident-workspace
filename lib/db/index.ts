import { Pool, type QueryResultRow } from "pg"

type GlobalWithPostgres = typeof globalThis & {
  __incidentWorkspacePool?: Pool
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || null
}

export function generateId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

/**
 * Returns an idempotent `ensureSchema` function. The setup callback runs once;
 * if it throws, the guard resets so the next call retries.
 */
export function createSchemaGuard(setup: () => Promise<void>) {
  let promise: Promise<void> | null = null

  return function ensureSchema() {
    if (!promise) {
      promise = setup().catch((error) => {
        promise = null
        throw error
      })
    }

    return promise
  }
}

export function isDatabaseConfigured() {
  return Boolean(getDatabaseUrl())
}

export function getDbPool() {
  const databaseUrl = getDatabaseUrl()

  if (!databaseUrl) {
    return null
  }

  const globalWithPostgres = globalThis as GlobalWithPostgres

  if (!globalWithPostgres.__incidentWorkspacePool) {
    // The app shell and module pages share one singleton pool per server process.
    globalWithPostgres.__incidentWorkspacePool = new Pool({
      connectionString: databaseUrl,
    })
  }

  return globalWithPostgres.__incidentWorkspacePool
}

export async function dbQuery<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  const pool = getDbPool()

  if (!pool) {
    throw new Error("DATABASE_URL is not configured.")
  }

  return pool.query<Row>(text, values)
}

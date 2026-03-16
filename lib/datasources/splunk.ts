import https from "node:https"

import type { EntityKind, EntityRef } from "@/lib/contracts/entities"
import type {
  DatasourceAdapter,
  DatasourceConfigPayload,
  DatasourceConnectionStatus,
  DatasourceSearchRequest,
  DatasourceSearchResult,
  StoredDatasourceInstallation,
} from "@/lib/datasources/types"

type SplunkEventEnvelope = {
  result?: Record<string, unknown>
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "")
}

function buildAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token.trim()}`,
  }
}

function resolveToken(config: DatasourceConfigPayload) {
  const token = typeof config.token === "string" ? config.token.trim() : ""

  if (!token) {
    throw new Error("Splunk token is missing.")
  }

  return token
}

function resolveSkipTlsVerify(config: DatasourceConfigPayload) {
  return config.skipTlsVerify === true
}

async function splunkFetch(
  url: string,
  options: RequestInit,
  skipTlsVerify: boolean,
): Promise<Response> {
  if (!skipTlsVerify) {
    return fetch(url, options)
  }

  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const reqOptions: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: (options.method as string) || "GET",
      headers: options.headers as Record<string, string>,
      rejectUnauthorized: false,
    }

    const req = https.request(reqOptions, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (chunk: Buffer) => chunks.push(chunk))
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8")
        resolve(
          new Response(body, {
            status: res.statusCode ?? 500,
            statusText: res.statusMessage ?? "",
          }),
        )
      })
    })

    req.on("error", reject)

    if (options.body) {
      req.write(options.body)
    }

    req.end()
  })
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) {
    return ""
  }

  if (typeof value === "string") {
    return value
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function sanitizeRow(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== null && value !== undefined && value !== ""),
  )
}

function summarizeRow(row: Record<string, unknown>) {
  const fields = Object.entries(sanitizeRow(row)).slice(0, 4)

  if (fields.length === 0) {
    return "Splunk returned a result row with no displayable fields."
  }

  return fields.map(([key, value]) => `${key}: ${stringifyValue(value)}`).join(" | ")
}

function pickOccurredAt(row: Record<string, unknown>) {
  const candidate = row._time ?? row.time ?? row.timestamp ?? row.occurred_at
  const value = stringifyValue(candidate).trim()

  return value.length > 0 ? value : null
}

function pushEntity(
  entities: EntityRef[],
  seen: Set<string>,
  kind: EntityKind,
  value: unknown,
  labelPrefix?: string,
) {
  const label = stringifyValue(value).trim()

  if (!label) {
    return
  }

  const entityId = `${kind}:${label.toLowerCase()}`

  if (seen.has(entityId)) {
    return
  }

  seen.add(entityId)
  entities.push({
    id: entityId,
    kind,
    label: labelPrefix ? `${labelPrefix}${label}` : label,
    sourceModule: "splunk",
  })
}

function extractEntities(row: Record<string, unknown>) {
  const entities: EntityRef[] = []
  const seen = new Set<string>()

  pushEntity(entities, seen, "host", row.host)
  pushEntity(entities, seen, "user", row.user ?? row.src_user)
  pushEntity(entities, seen, "identity", row.identity)
  pushEntity(entities, seen, "ip", row.src ?? row.src_ip)
  pushEntity(entities, seen, "ip", row.dest ?? row.dest_ip)
  pushEntity(entities, seen, "domain", row.domain)
  pushEntity(entities, seen, "url", row.url)
  pushEntity(entities, seen, "file", row.file_name ?? row.file_path)
  pushEntity(entities, seen, "process", row.process_name ?? row.process)
  pushEntity(entities, seen, "alert", row.rule_name ?? row.signature, "Alert: ")

  return entities
}

function deriveTitle(row: Record<string, unknown>) {
  const titleCandidate =
    row.rule_name ??
    row.signature ??
    row.alert ??
    row.message ??
    row.host ??
    row.source ??
    row.sourcetype

  const title = stringifyValue(titleCandidate).trim()

  return title.length > 0 ? title : "Splunk result"
}

function buildSourceUrl(baseUrl: string, query: string) {
  const url = new URL("/en-US/app/search/search", normalizeBaseUrl(baseUrl))
  url.searchParams.set("q", query)
  return url.toString()
}

function mapSearchRows(
  rows: Record<string, unknown>[],
  baseUrl: string,
  query: string,
): DatasourceSearchResult["rows"] {
  return rows.map((row, index) => {
    const resultRow = sanitizeRow(row)
    const idBasis =
      stringifyValue(resultRow._cd).trim() ||
      stringifyValue(resultRow._serial).trim() ||
      stringifyValue(resultRow._time).trim() ||
      stringifyValue(resultRow.host).trim() ||
      `${index}`

    return {
      id: `splunk-${idBasis}-${index}`,
      occurredAt: pickOccurredAt(resultRow),
      raw: resultRow,
      relatedEntities: extractEntities(resultRow),
      sourceUrl: buildSourceUrl(baseUrl, query),
      summary: summarizeRow(resultRow),
      title: deriveTitle(resultRow),
    }
  })
}

function parseSplunkExportPayload(payload: string) {
  return payload
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        return JSON.parse(line) as SplunkEventEnvelope
      } catch {
        return null
      }
    })
    .filter((item): item is SplunkEventEnvelope => item !== null)
    .map((item) => item.result)
    .filter((item): item is Record<string, unknown> => Boolean(item))
}

function toSearchString(query: string) {
  const trimmed = query.trim()

  if (trimmed.startsWith("search ")) {
    return trimmed
  }

  return `search ${trimmed}`
}

function buildSearchBody(request: DatasourceSearchRequest) {
  const params = new URLSearchParams()
  params.set("search", toSearchString(request.query))
  params.set("output_mode", "json")
  params.set("preview", "0")

  if (request.earliestTime?.trim()) {
    params.set("earliest_time", request.earliestTime.trim())
  }

  if (request.latestTime?.trim()) {
    params.set("latest_time", request.latestTime.trim())
  }

  if (request.limit && Number.isFinite(request.limit) && request.limit > 0) {
    params.set("max_count", String(request.limit))
  }

  return params
}

async function readResponseError(response: Response) {
  const payload = await response.text()
  const trimmed = payload.trim()

  if (!trimmed) {
    return `Splunk request failed with status ${response.status}.`
  }

  return `${response.status} ${response.statusText}: ${trimmed.slice(0, 280)}`
}

function assertSplunkDatasource(datasource: StoredDatasourceInstallation) {
  if (datasource.vendor !== "splunk") {
    throw new Error(`Datasource ${datasource.id} is not a Splunk datasource.`)
  }
}

async function testSplunkConnection(
  datasource: StoredDatasourceInstallation,
): Promise<DatasourceConnectionStatus> {
  assertSplunkDatasource(datasource)

  const startedAt = new Date().toISOString()
  const baseUrl = normalizeBaseUrl(datasource.baseUrl)
  const skipTlsVerify = resolveSkipTlsVerify(datasource.config)
  const response = await splunkFetch(
    `${baseUrl}/services/server/info?output_mode=json`,
    {
      cache: "no-store",
      headers: buildAuthHeaders(resolveToken(datasource.config)),
      method: "GET",
    },
    skipTlsVerify,
  )

  if (!response.ok) {
    throw new Error(await readResponseError(response))
  }

  return {
    checkedAt: startedAt,
    message: "Splunk datasource connection is healthy.",
    ok: true,
  }
}

async function runSplunkSearch(
  datasource: StoredDatasourceInstallation,
  request: DatasourceSearchRequest,
): Promise<DatasourceSearchResult> {
  assertSplunkDatasource(datasource)

  const startedAt = Date.now()
  const baseUrl = normalizeBaseUrl(datasource.baseUrl)
  const skipTlsVerify = resolveSkipTlsVerify(datasource.config)
  const response = await splunkFetch(
    `${baseUrl}/services/search/jobs/export`,
    {
      body: buildSearchBody(request).toString(),
      cache: "no-store",
      headers: {
        ...buildAuthHeaders(resolveToken(datasource.config)),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    },
    skipTlsVerify,
  )

  if (!response.ok) {
    throw new Error(await readResponseError(response))
  }

  const payload = await response.text()
  const rows = parseSplunkExportPayload(payload)

  return {
    executionTimeMs: Date.now() - startedAt,
    rowCount: rows.length,
    rows: mapSearchRows(rows, baseUrl, request.query),
  }
}

function validateSplunkConfig(
  config: DatasourceConfigPayload,
  options?: { existingConfig?: DatasourceConfigPayload | null },
) {
  const nextToken =
    (typeof config.token === "string" ? config.token.trim() : "") ||
    (typeof options?.existingConfig?.token === "string"
      ? options.existingConfig.token.trim()
      : "")

  if (!nextToken) {
    throw new Error("A Splunk token is required.")
  }

  return {
    skipTlsVerify: config.skipTlsVerify === true,
    token: nextToken,
  }
}

export const splunkAdapter: DatasourceAdapter = {
  definition: {
    capabilities: {
      supportsHealthcheck: true,
      supportsSearch: true,
    },
    description:
      "Global Splunk datasource for analyst-driven search, result review, and artifact promotion.",
    id: "splunk",
    title: "Splunk",
    vendor: "splunk",
  },
  executeSearch: runSplunkSearch,
  testConnection: testSplunkConnection,
  validateConfig: validateSplunkConfig,
}

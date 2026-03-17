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

const ASYNC_JOB_TIMEOUT_MS = 120_000
const POLL_INTERVAL_MS = 800

type SplunkJobStatus = {
  dispatchState: string
  isDone: boolean
  isFailed: boolean
  resultCount: number
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The operation was aborted.", "AbortError"))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(new DOMException("The operation was aborted.", "AbortError"))
    }, { once: true })
  })
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
  signal?: AbortSignal,
): Promise<Response> {
  if (!skipTlsVerify) {
    return fetch(url, { ...options, signal })
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The operation was aborted.", "AbortError"))
      return
    }

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
        signal?.removeEventListener("abort", onAbort)
        const body = Buffer.concat(chunks).toString("utf8")
        resolve(
          new Response(body, {
            status: res.statusCode ?? 500,
            statusText: res.statusMessage ?? "",
          }),
        )
      })
    })

    req.on("error", (err) => {
      signal?.removeEventListener("abort", onAbort)
      reject(err)
    })

    const onAbort = () => {
      req.destroy()
      reject(new DOMException("The operation was aborted.", "AbortError"))
    }

    signal?.addEventListener("abort", onAbort, { once: true })

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
  // Prefer _raw as the summary — it's the actual log line threat hunters care about
  const rawValue = typeof row._raw === "string" ? row._raw.trim() : ""
  if (rawValue.length > 0) {
    return rawValue.length > 300 ? `${rawValue.slice(0, 300)}…` : rawValue
  }

  // Fall back to non-internal fields
  const fields = Object.entries(sanitizeRow(row))
    .filter(([key]) => !key.startsWith("_"))
    .slice(0, 4)

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

  // Hosts
  pushEntity(entities, seen, "host", row.host)
  pushEntity(entities, seen, "host", row.dvc)
  pushEntity(entities, seen, "host", row.dest_host)

  // Users / accounts
  pushEntity(entities, seen, "user", row.user ?? row.src_user)
  pushEntity(entities, seen, "user", row.User)
  pushEntity(entities, seen, "account", row.account_name ?? row.account)
  pushEntity(entities, seen, "identity", row.identity)

  // IPs
  pushEntity(entities, seen, "ip", row.src ?? row.src_ip)
  pushEntity(entities, seen, "ip", row.dest ?? row.dest_ip)
  pushEntity(entities, seen, "ip", row.src_translated_ip)
  pushEntity(entities, seen, "ip", row.dest_translated_ip)

  // Network — ports mapped to service kind
  if (row.dest_port !== null && row.dest_port !== undefined && row.dest_port !== "") {
    pushEntity(entities, seen, "service", row.dest_port, "Port: ")
  }
  if (row.src_port !== null && row.src_port !== undefined && row.src_port !== "") {
    pushEntity(entities, seen, "service", row.src_port, "Port: ")
  }

  // Domains & URLs
  pushEntity(entities, seen, "domain", row.domain)
  pushEntity(entities, seen, "domain", row.dns)
  pushEntity(entities, seen, "url", row.url)

  // Files
  pushEntity(entities, seen, "file", row.file_name ?? row.file_path)
  pushEntity(entities, seen, "file", row.FileName)

  // Hashes — critical for malware analysis
  pushEntity(entities, seen, "hash", row.md5 ?? row.MD5, "MD5: ")
  pushEntity(entities, seen, "hash", row.sha256 ?? row.SHA256, "SHA256: ")
  pushEntity(entities, seen, "hash", row.sha1 ?? row.SHA1, "SHA1: ")
  pushEntity(entities, seen, "hash", row.file_hash)
  pushEntity(entities, seen, "hash", row.hash)

  // Processes — includes command lines and parent processes
  pushEntity(entities, seen, "process", row.process_name ?? row.process)
  pushEntity(entities, seen, "process", row.Process)
  pushEntity(entities, seen, "process", row.cmd_line ?? row.command_line ?? row.CommandLine, "Cmd: ")
  pushEntity(entities, seen, "process", row.parent_process_name ?? row.parent_process, "Parent: ")

  // Registry — Windows threat hunting
  pushEntity(entities, seen, "registry", row.registry_path ?? row.registry_key ?? row.RegistryPath)
  pushEntity(entities, seen, "registry", row.registry_value_name, "Value: ")

  // Cloud resources
  pushEntity(entities, seen, "cloud-resource", row.resource_id ?? row.cloud_resource)

  // Alerts / threat intel — includes MITRE ATT&CK
  pushEntity(entities, seen, "alert", row.rule_name ?? row.signature, "Alert: ")
  pushEntity(entities, seen, "alert", row.mitre_attack_id ?? row.mitre_technique_id ?? row.technique_id, "ATT&CK: ")
  pushEntity(entities, seen, "alert", row.tactic, "Tactic: ")

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

// Builds a time-scoped URL pointing at the ±60s window around the event's _time.
// Falls back to the query-level URL when no timestamp is available.
function buildEventSourceUrl(baseUrl: string, query: string, row: Record<string, unknown>) {
  const timeValue = row._time

  if (timeValue !== null && timeValue !== undefined) {
    const timeStr = stringifyValue(timeValue).trim()
    let epochSeconds: number | null = null

    if (typeof timeValue === "number") {
      epochSeconds = timeValue
    } else if (timeStr) {
      const parsed = Date.parse(timeStr)
      if (!isNaN(parsed)) {
        epochSeconds = parsed / 1000
      }
    }

    if (epochSeconds !== null) {
      const url = new URL("/en-US/app/search/search", normalizeBaseUrl(baseUrl))
      url.searchParams.set("q", query)
      url.searchParams.set("earliest", String(Math.floor(epochSeconds - 60)))
      url.searchParams.set("latest", String(Math.ceil(epochSeconds + 60)))
      return url.toString()
    }
  }

  return buildSourceUrl(baseUrl, query)
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
      sourceUrl: buildEventSourceUrl(baseUrl, query, resultRow),
      summary: summarizeRow(resultRow),
      title: deriveTitle(resultRow),
    }
  })
}

function toSearchString(query: string) {
  const trimmed = query.trim()

  if (trimmed.startsWith("search ")) {
    return trimmed
  }

  return `search ${trimmed}`
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

// --- Async job API ---

function buildJobCreationBody(request: DatasourceSearchRequest): URLSearchParams {
  const params = new URLSearchParams()
  params.set("search", toSearchString(request.query))

  if (request.earliestTime?.trim()) {
    params.set("earliest_time", request.earliestTime.trim())
  }

  if (request.latestTime?.trim()) {
    params.set("latest_time", request.latestTime.trim())
  }

  return params
}

async function createSplunkJob(
  baseUrl: string,
  headers: Record<string, string>,
  request: DatasourceSearchRequest,
  skipTlsVerify: boolean,
  signal?: AbortSignal,
): Promise<string> {
  const response = await splunkFetch(
    `${baseUrl}/services/search/jobs?output_mode=json`,
    {
      body: buildJobCreationBody(request).toString(),
      cache: "no-store",
      headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    },
    skipTlsVerify,
    signal,
  )

  if (!response.ok) {
    throw new Error(await readResponseError(response))
  }

  const json = (await response.json()) as { sid?: string }

  if (!json.sid) {
    throw new Error("Splunk did not return a search job ID.")
  }

  return json.sid
}

function parseSplunkJobStatus(json: unknown): SplunkJobStatus {
  const content =
    (json as { entry?: Array<{ content?: Record<string, unknown> }> })?.entry?.[0]?.content ?? {}

  const dispatchState = typeof content.dispatchState === "string" ? content.dispatchState : ""
  const isDone = content.isDone === true || content.isDone === "1" || content.isDone === 1

  return {
    dispatchState,
    isDone,
    isFailed: dispatchState === "FAILED",
    resultCount: typeof content.resultCount === "number" ? content.resultCount : 0,
  }
}

async function pollSplunkJobUntilDone(
  baseUrl: string,
  headers: Record<string, string>,
  sid: string,
  skipTlsVerify: boolean,
  signal?: AbortSignal,
): Promise<number> {
  const deadline = Date.now() + ASYNC_JOB_TIMEOUT_MS

  while (Date.now() < deadline) {
    signal?.throwIfAborted()

    const response = await splunkFetch(
      `${baseUrl}/services/search/jobs/${encodeURIComponent(sid)}?output_mode=json`,
      { cache: "no-store", headers, method: "GET" },
      skipTlsVerify,
      signal,
    )

    if (!response.ok) {
      throw new Error(await readResponseError(response))
    }

    const json = await response.json()
    const status = parseSplunkJobStatus(json)

    if (status.isFailed) {
      throw new Error(`Splunk search job failed (state: ${status.dispatchState}).`)
    }

    if (status.isDone) {
      return status.resultCount
    }

    await sleep(POLL_INTERVAL_MS, signal)
  }

  throw new Error(`Splunk search job timed out after ${ASYNC_JOB_TIMEOUT_MS / 1000}s.`)
}

async function fetchSplunkJobResults(
  baseUrl: string,
  headers: Record<string, string>,
  sid: string,
  limit: number,
  offset: number,
  skipTlsVerify: boolean,
  signal?: AbortSignal,
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams()
  params.set("output_mode", "json")
  params.set("count", String(limit))
  params.set("offset", String(offset))

  const response = await splunkFetch(
    `${baseUrl}/services/search/jobs/${encodeURIComponent(sid)}/results?${params.toString()}`,
    { cache: "no-store", headers, method: "GET" },
    skipTlsVerify,
    signal,
  )

  if (!response.ok) {
    throw new Error(await readResponseError(response))
  }

  const json = (await response.json()) as { results?: unknown[] }
  const results = Array.isArray(json.results) ? json.results : []

  return results.filter((r): r is Record<string, unknown> => r !== null && typeof r === "object")
}

async function deleteSplunkJob(
  baseUrl: string,
  headers: Record<string, string>,
  sid: string,
  skipTlsVerify: boolean,
): Promise<void> {
  try {
    await splunkFetch(
      `${baseUrl}/services/search/jobs/${encodeURIComponent(sid)}`,
      { headers, method: "DELETE" },
      skipTlsVerify,
    )
  } catch {
    // Best-effort cleanup — do not throw
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
  const headers = buildAuthHeaders(resolveToken(datasource.config))
  const limit = request.limit && request.limit > 0 ? request.limit : 25
  const offset = request.offset && request.offset > 0 ? request.offset : 0

  const signal = request.signal
  const sid = await createSplunkJob(baseUrl, headers, request, skipTlsVerify, signal)

  try {
    const totalCount = await pollSplunkJobUntilDone(baseUrl, headers, sid, skipTlsVerify, signal)
    const rows = await fetchSplunkJobResults(baseUrl, headers, sid, limit, offset, skipTlsVerify, signal)

    return {
      executionTimeMs: Date.now() - startedAt,
      rowCount: rows.length,
      totalCount,
      rows: mapSearchRows(rows, baseUrl, request.query),
    }
  } finally {
    // Always delete the Splunk job — including on abort/cancel so we don't leave orphaned jobs
    void deleteSplunkJob(baseUrl, headers, sid, skipTlsVerify)
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

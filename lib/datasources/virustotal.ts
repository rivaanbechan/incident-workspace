import type {
  DatasourceAdapter,
  DatasourceConfigPayload,
  DatasourceConnectionStatus,
  EnrichmentDatasource,
  StoredDatasourceInstallation,
} from "@/lib/datasources/types"
import type { AgentTool, EnrichmentResult } from "@/features/agents/lib/agentTools"
import type { EntityKind } from "@/lib/contracts/entities"

const VT_BASE_URL = "https://www.virustotal.com/api/v3"

const SUPPORTED_KINDS: EntityKind[] = ["ip", "domain", "hash"]

function resolveApiKey(config: DatasourceConfigPayload): string {
  const key = typeof config.apiKey === "string" ? config.apiKey.trim() : ""

  if (!key) {
    throw new Error("VirusTotal API key is missing.")
  }

  return key
}

function vtHeaders(apiKey: string) {
  return { "x-apikey": apiKey }
}

async function fetchVt(path: string, apiKey: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${VT_BASE_URL}${path}`, {
    headers: vtHeaders(apiKey),
    method: "GET",
  })

  if (response.status === 404) {
    return { notFound: true }
  }

  if (response.status === 401) {
    throw new Error("VirusTotal API key is invalid.")
  }

  if (response.status === 429) {
    throw new Error("VirusTotal rate limit exceeded.")
  }

  if (!response.ok) {
    throw new Error(`VirusTotal request failed with status ${response.status}.`)
  }

  return response.json() as Promise<Record<string, unknown>>
}

function extractStats(data: Record<string, unknown>): Record<string, number> {
  const attrs =
    (data?.data as Record<string, unknown>)?.attributes as Record<string, unknown> | undefined
  const stats = attrs?.last_analysis_stats as Record<string, number> | undefined
  return stats ?? {}
}

function vendorVerdict(malicious: number, suspicious: number, total: number): EnrichmentResult["verdict"] {
  if (total === 0) return "unknown"
  if (malicious >= 3) return "malicious"
  if (malicious > 0 || suspicious >= 5) return "malicious"
  return "benign"
}

function buildResult(
  data: Record<string, unknown>,
  entityValue: string,
  label: string,
): EnrichmentResult {
  if ((data as { notFound?: boolean }).notFound) {
    return {
      payload: {},
      summary: `${label} not found in VirusTotal database.`,
      title: `VirusTotal: ${entityValue}`,
      verdict: "unknown",
    }
  }

  const stats = extractStats(data)
  const malicious = stats.malicious ?? 0
  const suspicious = stats.suspicious ?? 0
  const undetected = stats.undetected ?? 0
  const harmless = stats.harmless ?? 0
  const total = malicious + suspicious + undetected + harmless
  const verdict = vendorVerdict(malicious, suspicious, total)

  const attrs =
    (data?.data as Record<string, unknown>)?.attributes as Record<string, unknown> | undefined
  const families = (attrs?.popular_threat_classification as Record<string, unknown>)
    ?.suggested_threat_label ?? null
  const communityScore =
    typeof attrs?.reputation === "number" ? attrs.reputation : null

  const summaryParts: string[] = [
    `${malicious}/${total} vendors flagged as malicious.`,
  ]
  if (families) summaryParts.push(`Threat label: ${String(families)}.`)
  if (communityScore !== null) summaryParts.push(`Community score: ${communityScore}.`)

  return {
    payload: { stats, communityScore, threatLabel: families },
    summary: summaryParts.join(" "),
    title: `VirusTotal: ${entityValue}`,
    verdict,
  }
}

async function enrichIp(value: string, apiKey: string): Promise<EnrichmentResult> {
  const data = await fetchVt(`/ip_addresses/${encodeURIComponent(value)}`, apiKey)
  return buildResult(data, value, "IP address")
}

async function enrichDomain(value: string, apiKey: string): Promise<EnrichmentResult> {
  const data = await fetchVt(`/domains/${encodeURIComponent(value)}`, apiKey)
  return buildResult(data, value, "Domain")
}

async function enrichHash(value: string, apiKey: string): Promise<EnrichmentResult> {
  const data = await fetchVt(`/files/${encodeURIComponent(value)}`, apiKey)
  return buildResult(data, value, "Hash")
}

export function toEnrichmentDatasource(
  datasource: StoredDatasourceInstallation,
): EnrichmentDatasource {
  return {
    apiKey: typeof datasource.config.apiKey === "string" ? datasource.config.apiKey : "",
    category: "enrichment",
    createdAt: datasource.createdAt,
    enabled: datasource.enabled,
    id: datasource.id,
    title: datasource.title,
    updatedAt: datasource.updatedAt,
    vendor: datasource.vendor,
  }
}

export class VirusTotalIntegration implements AgentTool {
  readonly id: string
  readonly name: string
  readonly description =
    "Looks up IPs, domains, and file hashes in VirusTotal. Returns reputation score, malware family, community score, and vendor verdicts."
  readonly supportedEntityKinds: EntityKind[] = SUPPORTED_KINDS

  private readonly apiKey: string

  constructor(datasource: EnrichmentDatasource) {
    this.id = datasource.id
    this.name = datasource.title
    this.apiKey = datasource.apiKey
  }

  async execute(entityKind: EntityKind, entityValue: string): Promise<EnrichmentResult> {
    if (entityKind === "ip") return enrichIp(entityValue, this.apiKey)
    if (entityKind === "domain") return enrichDomain(entityValue, this.apiKey)
    if (entityKind === "hash") return enrichHash(entityValue, this.apiKey)
    throw new Error(`VirusTotal does not support entity kind "${entityKind}".`)
  }
}

async function testVirusTotalConnection(
  datasource: StoredDatasourceInstallation,
): Promise<DatasourceConnectionStatus> {
  const checkedAt = new Date().toISOString()
  const apiKey = resolveApiKey(datasource.config)

  // Lightweight quota check endpoint
  const response = await fetch(`${VT_BASE_URL}/users/me/api_usage`, {
    headers: vtHeaders(apiKey),
    method: "GET",
  })

  if (response.status === 401) {
    throw new Error("VirusTotal API key is invalid.")
  }

  if (!response.ok) {
    throw new Error(`VirusTotal connection check failed with status ${response.status}.`)
  }

  return {
    checkedAt,
    message: "VirusTotal API key is valid and reachable.",
    ok: true,
  }
}

function validateVirusTotalConfig(
  config: DatasourceConfigPayload,
  options?: { existingConfig?: DatasourceConfigPayload | null },
): DatasourceConfigPayload {
  const apiKey =
    (typeof config.apiKey === "string" ? config.apiKey.trim() : "") ||
    (typeof options?.existingConfig?.apiKey === "string"
      ? options.existingConfig.apiKey.trim()
      : "")

  if (!apiKey) {
    throw new Error("A VirusTotal API key is required.")
  }

  return { apiKey }
}

export const virusTotalAdapter: DatasourceAdapter = {
  definition: {
    capabilities: {
      supportsHealthcheck: true,
      supportsSearch: false,
    },
    category: "enrichment",
    description:
      "VirusTotal enrichment for IPs, domains, and file hashes. Used by AI agents to provide threat intelligence.",
    id: "virustotal",
    title: "VirusTotal",
    vendor: "virustotal",
  },
  testConnection: testVirusTotalConnection,
  validateConfig: validateVirusTotalConfig,
}

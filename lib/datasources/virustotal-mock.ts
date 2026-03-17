import type {
  DatasourceAdapter,
  DatasourceConfigPayload,
  DatasourceConnectionStatus,
  EnrichmentDatasource,
  StoredDatasourceInstallation,
} from "@/lib/datasources/types"
import type { AgentTool, EnrichmentResult } from "@/features/agents/lib/agentTools"
import type { EntityKind } from "@/lib/contracts/entities"

const SUPPORTED_KINDS: EntityKind[] = ["ip", "domain", "hash"]

/**
 * Deterministic "malicious" check based on the entity value string.
 * Values containing "bad", "evil", "malware", or "malicious" are flagged.
 * The hash `44d88612fea8a8f36de82e1278abb02f` (EICAR) is always malicious.
 */
function isMaliciousValue(value: string): boolean {
  const lower = value.toLowerCase()
  if (/\b(bad|evil|malware|malicious)\b/.test(lower)) return true
  if (lower === "44d88612fea8a8f36de82e1278abb02f") return true
  if (lower === "185.220.101.34") return true // well-known Tor exit node used in demos
  return false
}

function isSuspiciousValue(value: string): boolean {
  const lower = value.toLowerCase()
  return /\b(suspicious|suspect|phish)\b/.test(lower)
}

function buildMockResult(
  entityValue: string,
  label: string,
): EnrichmentResult {
  if (isMaliciousValue(entityValue)) {
    return {
      payload: {
        communityScore: -87,
        stats: { malicious: 54, suspicious: 3, undetected: 12, harmless: 0 },
        threatLabel: "trojan.genericbackdoor",
      },
      summary: `54/69 vendors flagged as malicious. Threat label: trojan.genericbackdoor. Community score: -87.`,
      title: `VirusTotal (mock): ${entityValue}`,
      verdict: "malicious",
    }
  }

  if (isSuspiciousValue(entityValue)) {
    return {
      payload: {
        communityScore: -12,
        stats: { malicious: 1, suspicious: 7, undetected: 45, harmless: 16 },
        threatLabel: null,
      },
      summary: `1/69 vendors flagged as malicious; 7 flagged as suspicious. Community score: -12.`,
      title: `VirusTotal (mock): ${entityValue}`,
      verdict: "malicious",
    }
  }

  return {
    payload: {
      communityScore: 8,
      stats: { malicious: 0, suspicious: 0, undetected: 12, harmless: 57 },
      threatLabel: null,
    },
    summary: `0/69 vendors flagged as malicious. Community score: 8.`,
    title: `VirusTotal (mock): ${entityValue}`,
    verdict: "benign",
  }
}

export function toEnrichmentDatasource(
  datasource: StoredDatasourceInstallation,
): EnrichmentDatasource {
  return {
    apiKey: "",
    category: "enrichment",
    createdAt: datasource.createdAt,
    enabled: datasource.enabled,
    id: datasource.id,
    title: datasource.title,
    updatedAt: datasource.updatedAt,
    vendor: datasource.vendor,
  }
}

export class MockVirusTotalIntegration implements AgentTool {
  readonly id: string
  readonly name: string
  readonly description =
    "Mock VirusTotal lookup for IPs, domains, and file hashes. Returns simulated reputation scores for testing agents without a real API key."
  readonly supportedEntityKinds: EntityKind[] = SUPPORTED_KINDS

  constructor(datasource: EnrichmentDatasource) {
    this.id = datasource.id
    this.name = datasource.title
  }

  async execute(entityKind: EntityKind, entityValue: string): Promise<EnrichmentResult> {
    if (!SUPPORTED_KINDS.includes(entityKind)) {
      throw new Error(`VirusTotal (mock) does not support entity kind "${entityKind}".`)
    }

    // Simulate a brief network delay
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 400))

    const label =
      entityKind === "ip" ? "IP address" : entityKind === "domain" ? "Domain" : "Hash"

    return buildMockResult(entityValue, label)
  }
}

async function testMockConnection(
  _datasource: StoredDatasourceInstallation,
): Promise<DatasourceConnectionStatus> {
  return {
    checkedAt: new Date().toISOString(),
    message: "Mock VirusTotal datasource is ready. No API key required.",
    ok: true,
  }
}

function validateMockConfig(_config: DatasourceConfigPayload): DatasourceConfigPayload {
  return {}
}

export const mockVirusTotalAdapter: DatasourceAdapter = {
  definition: {
    capabilities: {
      supportsHealthcheck: true,
      supportsSearch: false,
    },
    category: "enrichment",
    description:
      "Simulated VirusTotal enrichment for testing AI agents. Returns deterministic mock verdicts — no API key required. Values containing 'bad', 'evil', or 'malware' are flagged malicious.",
    id: "virustotal-mock",
    title: "VirusTotal (Mock)",
    vendor: "virustotal-mock",
  },
  testConnection: testMockConnection,
  validateConfig: validateMockConfig,
}

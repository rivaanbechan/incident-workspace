import { describe, it, expect, vi, beforeEach } from "vitest"
import { VirusTotalIntegration } from "@/lib/datasources/virustotal"
import type { EnrichmentDatasource } from "@/lib/datasources/types"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

beforeEach(() => {
  vi.clearAllMocks()
})

const mockDatasource: EnrichmentDatasource = {
  apiKey: "test-api-key",
  category: "enrichment",
  createdAt: "2024-01-01T00:00:00Z",
  enabled: true,
  id: "virustotal-1",
  title: "VirusTotal",
  updatedAt: "2024-01-01T00:00:00Z",
  vendor: "virustotal",
}

function mockVtResponse(data: Record<string, unknown>, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as unknown as Response
}

function buildVtData(malicious: number, suspicious = 0, undetected = 10) {
  return {
    data: {
      attributes: {
        last_analysis_stats: { malicious, suspicious, undetected, harmless: 5 },
        reputation: malicious > 0 ? -20 : 5,
        popular_threat_classification: malicious > 0
          ? { suggested_threat_label: "trojan.generic" }
          : null,
      },
    },
  }
}

describe("VirusTotalIntegration — IP enrichment", () => {
  it("returns malicious verdict for flagged IP", async () => {
    mockFetch.mockResolvedValueOnce(mockVtResponse(buildVtData(10, 2)))
    const tool = new VirusTotalIntegration(mockDatasource)
    const result = await tool.execute("ip", "1.2.3.4")

    expect(result.verdict).toBe("malicious")
    expect(result.summary).toContain("10/")
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/ip_addresses/1.2.3.4"),
      expect.objectContaining({ headers: { "x-apikey": "test-api-key" } }),
    )
  })

  it("returns benign verdict for clean IP", async () => {
    mockFetch.mockResolvedValueOnce(mockVtResponse(buildVtData(0, 0)))
    const tool = new VirusTotalIntegration(mockDatasource)
    const result = await tool.execute("ip", "8.8.8.8")

    expect(result.verdict).toBe("benign")
  })

  it("returns unknown verdict when IP not found", async () => {
    mockFetch.mockResolvedValueOnce(mockVtResponse({}, 404))
    const tool = new VirusTotalIntegration(mockDatasource)
    const result = await tool.execute("ip", "192.0.2.1")

    expect(result.verdict).toBe("unknown")
    expect(result.summary).toContain("not found")
  })
})

describe("VirusTotalIntegration — domain enrichment", () => {
  it("calls domain endpoint", async () => {
    mockFetch.mockResolvedValueOnce(mockVtResponse(buildVtData(0)))
    const tool = new VirusTotalIntegration(mockDatasource)
    await tool.execute("domain", "example.com")

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/domains/example.com"),
      expect.any(Object),
    )
  })
})

describe("VirusTotalIntegration — hash enrichment", () => {
  it("calls files endpoint for hash", async () => {
    mockFetch.mockResolvedValueOnce(mockVtResponse(buildVtData(5)))
    const tool = new VirusTotalIntegration(mockDatasource)
    await tool.execute("hash", "abc123")

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/files/abc123"),
      expect.any(Object),
    )
  })
})

describe("VirusTotalIntegration — error handling", () => {
  it("throws on invalid API key", async () => {
    mockFetch.mockResolvedValueOnce(mockVtResponse({}, 401))
    const tool = new VirusTotalIntegration(mockDatasource)
    await expect(tool.execute("ip", "1.2.3.4")).rejects.toThrow("invalid")
  })

  it("throws on rate limit", async () => {
    mockFetch.mockResolvedValueOnce(mockVtResponse({}, 429))
    const tool = new VirusTotalIntegration(mockDatasource)
    await expect(tool.execute("ip", "1.2.3.4")).rejects.toThrow("rate limit")
  })

  it("throws for unsupported entity kind", async () => {
    const tool = new VirusTotalIntegration(mockDatasource)
    await expect(
      tool.execute("user" as Parameters<typeof tool.execute>[0], "alice"),
    ).rejects.toThrow("does not support")
  })
})

describe("VirusTotalIntegration — supported entity kinds", () => {
  it("declares ip, domain, hash as supported", () => {
    const tool = new VirusTotalIntegration(mockDatasource)
    expect(tool.supportedEntityKinds).toContain("ip")
    expect(tool.supportedEntityKinds).toContain("domain")
    expect(tool.supportedEntityKinds).toContain("hash")
  })
})

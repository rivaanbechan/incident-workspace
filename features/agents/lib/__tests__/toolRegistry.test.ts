import { describe, it, expect, vi, beforeEach } from "vitest"
import { getToolsForAgent } from "@/features/agents/lib/toolRegistry"

vi.mock("@/lib/db/agents", () => ({
  getAgentById: vi.fn(),
}))

vi.mock("@/lib/db/datasources", () => ({
  getStoredDatasourceById: vi.fn(),
}))

vi.mock("@/lib/datasources/virustotal", () => {
  const execute = vi.fn()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function MockVirusTotalIntegration(this: any, ds: { id: string; title: string }) {
    this.id = ds.id
    this.name = ds.title ?? "VirusTotal"
    this.description = "mocked"
    this.supportedEntityKinds = ["ip", "domain", "hash"]
    this.execute = execute
  }
  return {
    toEnrichmentDatasource: vi.fn((ds: Record<string, unknown>) => ({
      ...ds,
      apiKey: "key",
      category: "enrichment",
    })),
    VirusTotalIntegration: MockVirusTotalIntegration,
  }
})

const { getAgentById } = await import("@/lib/db/agents")
const { getStoredDatasourceById } = await import("@/lib/db/datasources")

const mockAgent = {
  id: "agent-1",
  orgId: "org-1",
  name: "L1 Analyst",
  personaPrompt: "...",
  tools: ["vt-1"],
  llmDatasourceId: "ollama-1",
  modelId: "llama3",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
}

const mockVtDatasource = {
  id: "vt-1",
  vendor: "virustotal",
  title: "VirusTotal",
  baseUrl: "",
  config: { apiKey: "test-key" },
  enabled: true,
  skipTlsVerify: false,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("getToolsForAgent", () => {
  it("returns empty array when agent not found", async () => {
    vi.mocked(getAgentById).mockResolvedValue(null)
    const tools = await getToolsForAgent("missing")
    expect(tools).toEqual([])
  })

  it("returns empty array when agent has no tools", async () => {
    vi.mocked(getAgentById).mockResolvedValue({ ...mockAgent, tools: [] })
    const tools = await getToolsForAgent("agent-1")
    expect(tools).toEqual([])
  })

  it("resolves virustotal tool ID to AgentTool instance", async () => {
    vi.mocked(getAgentById).mockResolvedValue(mockAgent)
    vi.mocked(getStoredDatasourceById).mockResolvedValue(mockVtDatasource as never)

    const tools = await getToolsForAgent("agent-1")
    expect(tools).toHaveLength(1)
    expect(tools[0].id).toBe("vt-1")
  })

  it("returns empty array when datasource no longer exists", async () => {
    vi.mocked(getAgentById).mockResolvedValue(mockAgent)
    vi.mocked(getStoredDatasourceById).mockResolvedValue(null)

    const tools = await getToolsForAgent("agent-1")
    expect(tools).toEqual([])
  })

  it("skips tools that throw on lookup without crashing", async () => {
    vi.mocked(getAgentById).mockResolvedValue({
      ...mockAgent,
      tools: ["bad-tool", "vt-1"],
    })
    vi.mocked(getStoredDatasourceById)
      .mockRejectedValueOnce(new Error("DB error"))
      .mockResolvedValueOnce(mockVtDatasource as never)

    const tools = await getToolsForAgent("agent-1")
    expect(tools).toHaveLength(1)
  })
})

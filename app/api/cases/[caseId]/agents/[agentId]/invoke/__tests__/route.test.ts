import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "@/app/api/cases/[caseId]/agents/[agentId]/invoke/route"

vi.mock("@/lib/auth/access", () => ({
  requireApiCasePermissionByCaseId: vi.fn(),
  forbiddenJson: vi.fn(() => new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })),
}))

vi.mock("@/lib/db/agents", () => ({
  getAgentById: vi.fn(),
}))

vi.mock("@/lib/db/datasources", () => ({
  getStoredDatasourceById: vi.fn(),
}))

vi.mock("@/lib/datasources/ollama", () => ({
  toLLMDatasource: vi.fn((ds) => ({
    ...ds,
    category: "llm",
    defaultModel: "llama3",
    maxConcurrent: 1,
    supportsToolCalling: false,
  })),
}))

vi.mock("@/lib/ai/concurrency", () => ({
  acquire: vi.fn(),
  release: vi.fn(),
}))

vi.mock("@/features/agents/lib/toolRegistry", () => ({
  getToolsForAgent: vi.fn(),
}))

vi.mock("@/lib/ai/ollama", () => ({
  generate: vi.fn(),
  generateFull: vi.fn(),
}))

const { requireApiCasePermissionByCaseId } = await import("@/lib/auth/access")
const { getAgentById } = await import("@/lib/db/agents")
const { getStoredDatasourceById } = await import("@/lib/db/datasources")
const { acquire, release } = await import("@/lib/ai/concurrency")
const { getToolsForAgent } = await import("@/features/agents/lib/toolRegistry")
const { generate } = await import("@/lib/ai/ollama")

const mockUser = { id: "user-1", orgId: "org-1", orgRole: "investigator", name: "Alice", email: "alice@example.com", color: "#ef4444", caseId: "case-1", caseRole: "case_editor", roomId: "room-1" }

const testAgent = {
  id: "agent-1",
  orgId: "org-1",
  name: "L1 Analyst",
  personaPrompt: "Analyse the IOC.",
  tools: [],
  llmDatasourceId: "ollama-1",
  modelId: "llama3",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
}

const testDatasource = {
  id: "ollama-1",
  vendor: "ollama",
  title: "Ollama",
  baseUrl: "http://localhost:11434",
  config: { defaultModel: "llama3", maxConcurrent: 1, supportsToolCalling: false },
  enabled: true,
  skipTlsVerify: false,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
}

const focusEntity = {
  id: "note-1",
  type: "note",
  title: "Suspicious IP",
  body: "8.8.8.8",
  x: 0,
  y: 0,
  width: 460,
  height: 420,
  zIndex: 1,
  color: "#fef08a",
  createdAt: 0,
  updatedAt: 0,
}

function params(caseId = "case-1", agentId = "agent-1") {
  return { params: Promise.resolve({ caseId, agentId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireApiCasePermissionByCaseId).mockResolvedValue({ access: mockUser as never, error: null })
  vi.mocked(getAgentById).mockResolvedValue(testAgent as never)
  vi.mocked(getStoredDatasourceById).mockResolvedValue(testDatasource as never)
  vi.mocked(acquire).mockReturnValue(true)
  vi.mocked(getToolsForAgent).mockResolvedValue([])
  vi.mocked(generate).mockImplementation(async function* () {
    yield "Analysis complete."
  })
})

describe("POST /api/cases/[caseId]/agents/[agentId]/invoke", () => {
  it("returns SSE stream for valid request", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ focusEntity }),
    })

    const response = await POST(request, params())

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/event-stream")
  })

  it("returns 403 for requests without write access", async () => {
    vi.mocked(requireApiCasePermissionByCaseId).mockResolvedValue({
      access: null,
      error: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }) as never,
    })

    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ focusEntity }),
    })

    const response = await POST(request, params())
    expect(response.status).toBe(403)
    expect(release).not.toHaveBeenCalled()
  })

  it("returns 409 when datasource is at capacity", async () => {
    vi.mocked(acquire).mockReturnValue(false)

    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ focusEntity }),
    })

    const response = await POST(request, params())
    expect(response.status).toBe(409)

    const body = await response.json() as { error: string }
    expect(body.error).toContain("capacity")
  })

  it("returns 404 when agent does not exist", async () => {
    vi.mocked(getAgentById).mockResolvedValue(null)

    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ focusEntity }),
    })

    const response = await POST(request, params())
    expect(response.status).toBe(404)
  })

  it("releases concurrency slot even when stream errors", async () => {
    vi.mocked(generate).mockImplementation(async function* () {
      throw new Error("Ollama crashed")
    })

    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ focusEntity }),
    })

    const response = await POST(request, params())
    // Drain the stream to trigger the finally block
    if (response.body) {
      const reader = response.body.getReader()
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }
    }

    expect(release).toHaveBeenCalledWith("ollama-1")
  })
})

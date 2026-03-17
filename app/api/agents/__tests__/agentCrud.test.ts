import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET as listAgents, POST as createAgent } from "@/app/api/agents/route"
import {
  GET as getAgent,
  PATCH as updateAgent,
  DELETE as deleteAgent,
} from "@/app/api/agents/[agentId]/route"

vi.mock("@/lib/auth/access", () => ({
  requireApiOrgPermission: vi.fn(),
  unauthorizedJson: vi.fn(() => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })),
  forbiddenJson: vi.fn(() => new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })),
}))

vi.mock("@/lib/db/agents", () => ({
  listAgentsByOrg: vi.fn(),
  createAgent: vi.fn(),
  getAgentById: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
}))

const { requireApiOrgPermission } = await import("@/lib/auth/access")
const db = await import("@/lib/db/agents")

const mockUser = { id: "user-1", orgId: "org-1", orgRole: "org_admin", name: "Alice", email: "alice@example.com", color: "#ef4444" }

function mockAdmin() {
  vi.mocked(requireApiOrgPermission).mockResolvedValue({ error: null, user: mockUser as never })
}

function mockForbidden() {
  vi.mocked(requireApiOrgPermission).mockResolvedValue({
    error: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }) as never,
    user: null,
  })
}

const testAgent = {
  id: "agent-1",
  orgId: "org-1",
  name: "L1 Analyst",
  personaPrompt: "You are an analyst.",
  tools: ["vt-1"],
  llmDatasourceId: "ollama-1",
  modelId: "llama3",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("GET /api/agents", () => {
  it("returns agents for org admin", async () => {
    mockAdmin()
    vi.mocked(db.listAgentsByOrg).mockResolvedValue([testAgent])

    const response = await listAgents()
    const body = await response.json() as { agents: typeof testAgent[] }

    expect(response.status).toBe(200)
    expect(body.agents).toHaveLength(1)
    expect(body.agents[0].name).toBe("L1 Analyst")
  })

  it("rejects non-admin requests", async () => {
    mockForbidden()
    const response = await listAgents()
    expect(response.status).toBe(403)
  })
})

describe("POST /api/agents", () => {
  it("creates an agent", async () => {
    mockAdmin()
    vi.mocked(db.createAgent).mockResolvedValue(testAgent)

    const request = new Request("http://localhost/api/agents", {
      method: "POST",
      body: JSON.stringify({
        name: "L1 Analyst",
        personaPrompt: "You are an analyst.",
        tools: ["vt-1"],
        llmDatasourceId: "ollama-1",
        modelId: "llama3",
      }),
    })

    const response = await createAgent(request)
    expect(response.status).toBe(201)
    const body = await response.json() as { agent: typeof testAgent }
    expect(body.agent.name).toBe("L1 Analyst")
  })

  it("returns 400 when name is missing", async () => {
    mockAdmin()

    const request = new Request("http://localhost/api/agents", {
      method: "POST",
      body: JSON.stringify({ llmDatasourceId: "ollama-1", modelId: "llama3" }),
    })

    const response = await createAgent(request)
    expect(response.status).toBe(400)
  })

  it("rejects non-admin requests", async () => {
    mockForbidden()
    const request = new Request("http://localhost/api/agents", {
      method: "POST",
      body: JSON.stringify({}),
    })
    const response = await createAgent(request)
    expect(response.status).toBe(403)
  })
})

describe("GET /api/agents/[agentId]", () => {
  it("returns agent by ID", async () => {
    mockAdmin()
    vi.mocked(db.getAgentById).mockResolvedValue(testAgent)

    const response = await getAgent(new Request("http://localhost"), {
      params: Promise.resolve({ agentId: "agent-1" }),
    })
    const body = await response.json() as { agent: typeof testAgent }
    expect(body.agent.id).toBe("agent-1")
  })

  it("returns 404 when agent not found", async () => {
    mockAdmin()
    vi.mocked(db.getAgentById).mockResolvedValue(null)

    const response = await getAgent(new Request("http://localhost"), {
      params: Promise.resolve({ agentId: "missing" }),
    })
    expect(response.status).toBe(404)
  })
})

describe("PATCH /api/agents/[agentId]", () => {
  it("updates an agent", async () => {
    mockAdmin()
    vi.mocked(db.updateAgent).mockResolvedValue({ ...testAgent, name: "Updated Name" })

    const response = await updateAgent(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated Name" }),
      }),
      { params: Promise.resolve({ agentId: "agent-1" }) },
    )

    const body = await response.json() as { agent: typeof testAgent }
    expect(body.agent.name).toBe("Updated Name")
  })
})

describe("DELETE /api/agents/[agentId]", () => {
  it("deletes an agent", async () => {
    mockAdmin()
    vi.mocked(db.deleteAgent).mockResolvedValue("agent-1")

    const response = await deleteAgent(new Request("http://localhost"), {
      params: Promise.resolve({ agentId: "agent-1" }),
    })

    expect(response.status).toBe(200)
    const body = await response.json() as { id: string }
    expect(body.id).toBe("agent-1")
  })

  it("returns 404 when agent not found", async () => {
    mockAdmin()
    vi.mocked(db.deleteAgent).mockResolvedValue(null)

    const response = await deleteAgent(new Request("http://localhost"), {
      params: Promise.resolve({ agentId: "missing" }),
    })
    expect(response.status).toBe(404)
  })
})

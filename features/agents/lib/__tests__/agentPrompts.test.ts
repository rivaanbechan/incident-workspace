import { describe, it, expect } from "vitest"
import { buildSystemPrompt } from "@/features/agents/lib/agentPrompts"
import type { Agent } from "@/lib/contracts/agents"
import type { AgentTool } from "@/features/agents/lib/agentTools"

const baseAgent: Agent = {
  createdAt: "2024-01-01T00:00:00Z",
  id: "agent-1",
  llmDatasourceId: "ollama-1",
  name: "L1 Analyst",
  orgId: "org-1",
  personaPrompt: "You are an L1 security analyst.",
  tools: [],
  updatedAt: "2024-01-01T00:00:00Z",
}

const mockTool: AgentTool = {
  id: "vt-1",
  name: "VirusTotal",
  description: "Checks IPs, domains, and hashes.",
  supportedEntityKinds: ["ip", "domain", "hash"],
  execute: async () => ({
    payload: {},
    summary: "clean",
    title: "VT",
    verdict: "benign",
  }),
}

describe("buildSystemPrompt", () => {
  it("includes persona prompt", () => {
    const prompt = buildSystemPrompt(baseAgent, [], "")
    expect(prompt).toContain("You are an L1 security analyst.")
  })

  it("injects tool descriptions", () => {
    const prompt = buildSystemPrompt(baseAgent, [mockTool], "some context")
    expect(prompt).toContain("VirusTotal")
    expect(prompt).toContain("Checks IPs, domains, and hashes.")
    expect(prompt).toContain("ip, domain, hash")
  })

  it("includes board context", () => {
    const context = "=== FOCUSED ENTITY ===\nid: note-1\ntitle: Suspicious IP"
    const prompt = buildSystemPrompt(baseAgent, [], context)
    expect(prompt).toContain("Suspicious IP")
  })

  it("tool descriptions appear after persona", () => {
    const prompt = buildSystemPrompt(baseAgent, [mockTool], "ctx")
    const personaIndex = prompt.indexOf(baseAgent.personaPrompt)
    const toolIndex = prompt.indexOf("VirusTotal")
    expect(toolIndex).toBeGreaterThan(personaIndex)
  })

  it("returns a non-empty prompt even with no tools or context", () => {
    const prompt = buildSystemPrompt(baseAgent, [], "")
    expect(prompt.trim().length).toBeGreaterThan(0)
  })
})

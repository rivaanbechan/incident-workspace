import type { Agent } from "@/lib/contracts/agents"
import type { AgentTool } from "@/features/agents/lib/agentTools"

/**
 * Assembles the system prompt for an agent invocation.
 */
export function buildSystemPrompt(
  agent: Agent,
  tools: AgentTool[],
  boardContext: string,
): string {
  const parts: string[] = []

  parts.push(agent.personaPrompt.trim())

  if (tools.length > 0) {
    parts.push("")
    parts.push("=== AVAILABLE TOOLS ===")

    for (const tool of tools) {
      parts.push(`Tool: ${tool.name}`)
      parts.push(`Description: ${tool.description}`)
      parts.push(`Supported entity kinds: ${tool.supportedEntityKinds.join(", ")}`)
    }
  }

  if (boardContext.trim()) {
    parts.push("")
    parts.push("=== BOARD CONTEXT ===")
    parts.push(boardContext.trim())
  }

  return parts.join("\n")
}

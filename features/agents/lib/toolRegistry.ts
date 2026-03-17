import { getAgentById } from "@/lib/db/agents"
import { getStoredDatasourceById } from "@/lib/db/datasources"
import { toEnrichmentDatasource, VirusTotalIntegration } from "@/lib/datasources/virustotal"
import {
  toEnrichmentDatasource as toMockEnrichmentDatasource,
  MockVirusTotalIntegration,
} from "@/lib/datasources/virustotal-mock"
import type { AgentTool } from "@/features/agents/lib/agentTools"

/**
 * Maps datasource vendor to an AgentTool factory.
 * Add new enrichment integrations here as they are registered.
 */
function instantiateEnrichmentTool(
  datasource: Awaited<ReturnType<typeof getStoredDatasourceById>>,
): AgentTool | null {
  if (!datasource) {
    return null
  }

  if (datasource.vendor === "virustotal") {
    return new VirusTotalIntegration(toEnrichmentDatasource(datasource))
  }

  if (datasource.vendor === "virustotal-mock") {
    return new MockVirusTotalIntegration(toMockEnrichmentDatasource(datasource))
  }

  return null
}

/**
 * Loads and instantiates the configured tools for an agent.
 * Returns an empty array if the agent has no tools or a tool's datasource no longer exists.
 * Never throws due to a missing tool — that would block invocation entirely.
 */
export async function getToolsForAgent(agentId: string): Promise<AgentTool[]> {
  const agent = await getAgentById(agentId)

  if (!agent || agent.tools.length === 0) {
    return []
  }

  const tools: AgentTool[] = []

  for (const toolId of agent.tools) {
    try {
      const datasource = await getStoredDatasourceById(toolId)
      const tool = instantiateEnrichmentTool(datasource)

      if (tool) {
        tools.push(tool)
      }
    } catch {
      // Silently skip unavailable tools — invocation continues with remaining tools
    }
  }

  return tools
}

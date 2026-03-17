import type { EntityKind } from "@/lib/contracts/entities"

export type EnrichmentResult = {
  payload: Record<string, unknown>
  summary: string
  title: string
  verdict: "benign" | "malicious" | "unknown"
}

/**
 * Interface that enrichment datasource integrations implement at runtime.
 * The stored config (EnrichmentDatasource in types.ts) is what toolRegistry uses
 * to instantiate these. AgentTool is the live, callable form.
 */
export interface AgentTool {
  id: string
  name: string
  description: string
  supportedEntityKinds: EntityKind[]
  execute(entityKind: EntityKind, entityValue: string): Promise<EnrichmentResult>
}

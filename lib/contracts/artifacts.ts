import type { ModuleDeepLink } from "@/lib/contracts/deepLinks"
import type { EntityRef } from "@/lib/contracts/entities"

export type ArtifactKind =
  | "decision"
  | "evidence"
  | "finding"
  | "graph-selection"
  | "hypothesis"
  | "ioc"
  | "note"
  | "sigma-match"
  | "timeline-event"

// Artifacts are the portable handoff object between modules.
// A module can emit one, persist one, or ask another module to ingest one.
export type InvestigationArtifact = {
  createdAt: number
  deepLink?: ModuleDeepLink
  id: string
  kind: ArtifactKind
  relatedEntities?: EntityRef[]
  sourceModule: string
  summary: string
  title: string
  // The payload is intentionally open-ended so each module can carry its own
  // detail without forcing the shared contract layer to know every schema.
  payload: Record<string, unknown>
}

export type PersistedInvestigationArtifact = InvestigationArtifact & {
  persistedAt: string
  roomId: string
}

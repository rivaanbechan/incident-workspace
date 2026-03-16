import type { InvestigationArtifact } from "@/lib/contracts/artifacts"
import type { ModuleDeepLink } from "@/lib/contracts/deepLinks"
import type { EntityRef } from "@/lib/contracts/entities"

export type ModuleAction =
  | {
      type: "create-artifact"
      artifact: InvestigationArtifact
    }
  | {
      type: "open-deep-link"
      deepLink: ModuleDeepLink
    }
  | {
      type: "promote-entities"
      entities: EntityRef[]
      sourceModule: string
    }
  | {
      type: "send-artifact-to-module"
      artifact: InvestigationArtifact
      targetModuleId: string
    }

// This envelope makes it explicit which module produced the action and when.
// It is suitable for a future shell action bus, action queue, or audit log.
export type ModuleActionEnvelope = {
  action: ModuleAction
  createdAt: number
  sourceModule: string
}

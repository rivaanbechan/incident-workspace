import { collabHuntGraphModule } from "@/features/collab-hunt-graph"
import { casesModule } from "@/features/cases"
import { incidentWorkspaceModule } from "@/features/incident-workspace"
import { integrationsModule } from "@/features/integrations"
import type { AppModuleManifest } from "@/lib/modules/types"

export const appModules: AppModuleManifest[] = [
  casesModule,
  incidentWorkspaceModule,
  collabHuntGraphModule,
  integrationsModule,
]

export function getModuleById(moduleId: string) {
  return appModules.find((module) => module.id === moduleId) ?? null
}

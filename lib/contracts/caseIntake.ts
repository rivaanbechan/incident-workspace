import type { EntityRef } from "@/lib/contracts/entities"
import type { Investigation, InvestigationSeverity } from "@/lib/contracts/investigations"

export type CaseIntakeSource = {
  externalId: string
  system: string
}

export type CaseIntakePayload = {
  entities?: EntityRef[]
  owner?: string
  severity?: InvestigationSeverity
  source: CaseIntakeSource
  summary?: string
  title: string
}

export type CaseIntakeResult = {
  caseUrl: string
  created: boolean
  investigation: Investigation
  roomUrl: string
  workspaceUrl: string
}

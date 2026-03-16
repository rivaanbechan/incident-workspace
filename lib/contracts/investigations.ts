export type InvestigationStatus = "open" | "monitoring" | "mitigated" | "closed"

export type InvestigationSeverity = "low" | "medium" | "high" | "critical"

export type Investigation = {
  archivedAt: string | null
  createdAt: string
  id: string
  owner: string
  roomId: string
  sourceExternalId?: string | null
  sourceSystem?: string | null
  severity: InvestigationSeverity
  status: InvestigationStatus
  summary: string
  title: string
  updatedAt: string
}

export type InvestigationAggregateCounts = {
  boardEntityCount: number
  decisionCount: number
  entityCount: number
  evidenceSetCount: number
  findingCount: number
  hypothesisCount: number
  openActionCount: number
  timelineEntryCount: number
}

export type InvestigationOverview = Investigation & {
  counts: InvestigationAggregateCounts
}

export type InvestigationActivity = {
  createdAt: string
  id: string
  investigationId: string
  kind:
    | "archived"
    | "case_created"
    | "deleted_permanently"
    | "metadata_updated"
    | "restored"
  summary: string
}

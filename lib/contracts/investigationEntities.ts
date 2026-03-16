export type InvestigationEntityKind =
  | "domain"
  | "email"
  | "file"
  | "host"
  | "identity"
  | "ip"
  | "process"
  | "service"
  | "url"
  | "other"

export type InvestigationEntity = {
  createdAt: string
  id: string
  investigationId: string
  kind: InvestigationEntityKind
  label: string
  payload: Record<string, unknown>
  updatedAt: string
  value: string
}

export type InvestigationEntityLinkTargetKind =
  | "artifact"
  | "case-record"
  | "evidence-set"

export type InvestigationEntityLinkSummary = {
  targetId: string
  targetKind: InvestigationEntityLinkTargetKind
}

export type InvestigationEntitySummary = InvestigationEntity & {
  artifactCount: number
  caseRecordCount: number
  decisionCount: number
  evidenceSetCount: number
  findingCount: number
  hypothesisCount: number
  openActionCount: number
}

export type InvestigationEntityDetail = InvestigationEntitySummary & {
  artifacts: Array<{
    id: string
    kind: string
    summary: string
    title: string
  }>
  evidenceSets: Array<{
    id: string
    resultCount: number
    summary: string
    title: string
  }>
  links: InvestigationEntityLinkSummary[]
  caseRecords: Array<{
    id: string
    kind: string
    summary: string
    title: string
    updatedAt: string
  }>
}

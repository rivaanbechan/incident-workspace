import type { ModuleDeepLink } from "@/lib/contracts/deepLinks"
import type { EntityRef } from "@/lib/contracts/entities"

export type InvestigationCaseRecordKind =
  | "action"
  | "decision"
  | "evidence"
  | "finding"
  | "hypothesis"
  | "timeline-event"

export type InvestigationCaseRecordSourceType =
  | "action-item"
  | "artifact"
  | "case-record"
  | "evidence-set"
  | "incident-card"
  | "note"
  | "timeline-entry"

export type InvestigationCaseRecordPayload = {
  dueAt?: string | null
  linkedArtifactIds?: string[]
  linkedEvidenceSetIds?: string[]
  owner?: string
  status?: string
  [key: string]: unknown
}

export type InvestigationCaseRecord = {
  createdAt: string
  deepLink?: ModuleDeepLink
  id: string
  investigationId: string
  kind: InvestigationCaseRecordKind
  payload: InvestigationCaseRecordPayload
  relatedEntities: EntityRef[]
  sourceId: string
  sourceModule: string
  sourceRoomId: string
  sourceType: InvestigationCaseRecordSourceType
  summary: string
  title: string
  updatedAt: string
}

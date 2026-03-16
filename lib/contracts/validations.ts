import type {
  InvestigationCaseRecordKind,
  InvestigationCaseRecordPayload,
  InvestigationCaseRecordSourceType,
} from "@/lib/contracts/caseRecords"
import type { EntityRef } from "@/lib/contracts/entities"
import type { InvestigationEntityKind } from "@/lib/contracts/investigationEntities"

export function isValidCaseRecordKind(value: string): value is InvestigationCaseRecordKind {
  return (
    value === "action" ||
    value === "decision" ||
    value === "evidence" ||
    value === "finding" ||
    value === "hypothesis" ||
    value === "timeline-event"
  )
}

export function isValidCaseRecordSourceType(
  value: string,
): value is InvestigationCaseRecordSourceType {
  return (
    value === "action-item" ||
    value === "artifact" ||
    value === "case-record" ||
    value === "evidence-set" ||
    value === "incident-card" ||
    value === "note" ||
    value === "timeline-entry"
  )
}

export function isValidInvestigationEntityKind(
  value: string,
): value is InvestigationEntityKind {
  return (
    value === "domain" ||
    value === "email" ||
    value === "file" ||
    value === "host" ||
    value === "identity" ||
    value === "ip" ||
    value === "process" ||
    value === "service" ||
    value === "url" ||
    value === "other"
  )
}

export function normalizeEntityRefs(value: unknown): EntityRef[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is EntityRef => {
    return (
      typeof item === "object" &&
      item !== null &&
      typeof (item as EntityRef).id === "string" &&
      typeof (item as EntityRef).kind === "string" &&
      typeof (item as EntityRef).label === "string"
    )
  })
}

export function normalizeRecordPayload(value: unknown): InvestigationCaseRecordPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as InvestigationCaseRecordPayload
}

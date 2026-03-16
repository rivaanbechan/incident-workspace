import type { InvestigationArtifact } from "@/lib/contracts/artifacts"
import type {
  InvestigationCaseRecord,
  InvestigationCaseRecordKind,
  InvestigationCaseRecordPayload,
  InvestigationCaseRecordSourceType,
} from "@/lib/contracts/caseRecords"
import type { EntityRef } from "@/lib/contracts/entities"
import type { SavedDatasourceResultSet } from "@/lib/datasources/types"
import { apiRequest } from "@/lib/api/client"

type CreateCaseRecordViaApiInput = {
  caseId: string
  record: {
    deepLink?: { href: string; moduleId: string }
    kind: InvestigationCaseRecordKind
    payload?: InvestigationCaseRecordPayload
    relatedEntities?: EntityRef[]
    sourceId: string
    sourceModule: string
    sourceRoomId: string
    sourceType: InvestigationCaseRecordSourceType
    summary: string
    title: string
  }
}

export async function createCaseRecordViaApi(input: CreateCaseRecordViaApiInput) {
  return apiRequest<InvestigationCaseRecord>(`/api/cases/${input.caseId}/records`, {
    body: JSON.stringify({ record: input.record }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })
}

function mapArtifactKindToCaseKind(
  kind: InvestigationArtifact["kind"],
): InvestigationCaseRecordKind {
  if (kind === "decision") {
    return "decision"
  }

  if (kind === "hypothesis") {
    return "hypothesis"
  }

  if (kind === "evidence" || kind === "note") {
    return "evidence"
  }

  if (kind === "timeline-event") {
    return "timeline-event"
  }

  return "finding"
}

export function buildArtifactCasePromotionInput(input: {
  artifact: InvestigationArtifact
  caseId: string
  roomId: string
}) {
  return {
    caseId: input.caseId,
    record: {
      deepLink: input.artifact.deepLink,
      kind: mapArtifactKindToCaseKind(input.artifact.kind),
      payload: {
        artifactKind: input.artifact.kind,
        linkedArtifactIds: [input.artifact.id],
      },
      relatedEntities: input.artifact.relatedEntities ?? [],
      sourceId: input.artifact.id,
      sourceModule: input.artifact.sourceModule,
      sourceRoomId: input.roomId,
      sourceType: "artifact" as const,
      summary: input.artifact.summary,
      title: input.artifact.title,
    },
  } satisfies CreateCaseRecordViaApiInput
}

export function buildSavedEvidenceSetCasePromotionInput(input: {
  caseId: string
  resultSet: SavedDatasourceResultSet
  roomId: string
}) {
  return {
    caseId: input.caseId,
    record: {
      deepLink: input.resultSet.rows[0]?.sourceUrl
        ? {
            href: input.resultSet.rows[0].sourceUrl,
            moduleId: "incident-workspace",
          }
        : undefined,
      kind: "evidence" as const,
      payload: {
        datasourceId: input.resultSet.datasourceId,
        datasourceTitle: input.resultSet.datasourceTitle,
        earliestTime: input.resultSet.earliestTime,
        latestTime: input.resultSet.latestTime,
        linkedEvidenceSetIds: [input.resultSet.id],
        query: input.resultSet.query,
        resultCount: input.resultSet.resultCount,
        vendor: input.resultSet.vendor,
      },
      relatedEntities: input.resultSet.relatedEntities,
      sourceId: input.resultSet.id,
      sourceModule: input.resultSet.vendor,
      sourceRoomId: input.roomId,
      sourceType: "evidence-set" as const,
      summary: input.resultSet.summary,
      title: input.resultSet.title,
    },
  } satisfies CreateCaseRecordViaApiInput
}

import type {
  InvestigationAggregateCounts,
  InvestigationOverview,
} from "@/lib/contracts/investigations"
import { listArtifactKindsByRoomIds } from "@/lib/db/artifacts"
import { listInvestigationCaseRecordsByInvestigationIds } from "@/lib/db/caseRecords"
import { countSavedDatasourceResultSetsByRoom } from "@/lib/db/datasourceResults"
import { getDbPool } from "@/lib/db/index"
import {
  type InvestigationFilters,
  listInvestigationActivityCountsByIds,
  listInvestigationRows,
} from "@/lib/db/investigations"
import { listInvestigationEntitiesByInvestigationIds } from "@/lib/db/investigationEntities"
import { listRoomDocumentSummaries } from "@/lib/db/roomDocuments"

const ZERO_COUNTS: InvestigationAggregateCounts = {
  boardEntityCount: 0,
  decisionCount: 0,
  entityCount: 0,
  evidenceSetCount: 0,
  findingCount: 0,
  hypothesisCount: 0,
  openActionCount: 0,
  timelineEntryCount: 0,
}

async function listAggregateCountsByInvestigation(
  investigations: Array<{ id: string; roomId: string }>,
) {
  if (!getDbPool() || investigations.length === 0) {
    return new Map<string, InvestigationAggregateCounts>()
  }

  const roomIds = investigations.map((i) => i.roomId)
  const investigationIds = investigations.map((i) => i.id)

  const [artifactKinds, caseRecordMap, evidenceSetCountMap, entityMap, roomSummaryMap, activityCountMap] =
    await Promise.all([
      listArtifactKindsByRoomIds(roomIds),
      listInvestigationCaseRecordsByInvestigationIds(investigationIds),
      countSavedDatasourceResultSetsByRoom(roomIds),
      listInvestigationEntitiesByInvestigationIds(investigationIds),
      listRoomDocumentSummaries(roomIds),
      listInvestigationActivityCountsByIds(investigationIds),
    ])

  return new Map(
    investigations.map((investigation) => {
      const roomId = investigation.roomId
      const roomArtifacts = artifactKinds.filter((row) => row.room_id === roomId)
      const caseRecords = caseRecordMap.get(investigation.id) ?? []
      const durableEntities = entityMap.get(investigation.id) ?? []
      const roomSummary = roomSummaryMap.get(roomId)
      const activityCount = activityCountMap.get(investigation.id) ?? 0
      let decisionCount = 0
      let artifactTimelineCount = 0
      let caseRecordTimelineCount = 0
      let findingCount = 0
      let hypothesisCount = 0
      let openActionCount = 0

      for (const row of roomArtifacts) {
        artifactTimelineCount += 1

        if (row.kind === "decision") {
          decisionCount += 1
        }

        if (
          row.kind === "finding" ||
          row.kind === "sigma-match" ||
          row.kind === "graph-selection" ||
          row.kind === "ioc"
        ) {
          findingCount += 1
        }

        if (row.kind === "hypothesis") {
          hypothesisCount += 1
        }
      }

      for (const record of caseRecords) {
        caseRecordTimelineCount += 1

        if (record.kind === "decision") {
          decisionCount += 1
        }

        if (record.kind === "finding") {
          findingCount += 1
        }

        if (record.kind === "hypothesis") {
          hypothesisCount += 1
        }

        if (record.kind === "action") {
          const status = record.payload.status

          if (status !== "done") {
            openActionCount += 1
          }
        }
      }

      return [
        investigation.id,
        {
          boardEntityCount: roomSummary?.boardEntityCount ?? 0,
          decisionCount,
          entityCount: durableEntities.length,
          evidenceSetCount: evidenceSetCountMap.get(roomId) ?? 0,
          findingCount,
          hypothesisCount,
          openActionCount,
          timelineEntryCount: activityCount + artifactTimelineCount + caseRecordTimelineCount,
        } satisfies InvestigationAggregateCounts,
      ] as const
    }),
  )
}

export async function listInvestigations(filters: InvestigationFilters = {}) {
  const investigations = await listInvestigationRows(filters)
  const countMap = await listAggregateCountsByInvestigation(investigations)

  return investigations.map((investigation) => ({
    ...investigation,
    counts: countMap.get(investigation.id) ?? ZERO_COUNTS,
  })) satisfies InvestigationOverview[]
}

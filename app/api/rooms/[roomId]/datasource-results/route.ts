import { NextResponse } from "next/server"

import { requireApiCasePermissionByRoomId } from "@/lib/auth/access"
import type { InvestigationArtifact } from "@/lib/contracts/artifacts"
import {
  createSavedDatasourceResultSet,
  listSavedDatasourceResultSets,
} from "@/lib/db/datasourceResults"
import { createRoomArtifact } from "@/lib/db/artifacts"
import { getInvestigationByRoomId } from "@/lib/db/investigations"
import type { DatasourceSearchRow } from "@/lib/datasources"

type RouteContext = {
  params: Promise<{
    roomId: string
  }>
}

type CreateSavedResultPayload = {
  artifact?: InvestigationArtifact
  datasourceId?: string
  datasourceTitle?: string
  earliestTime?: string
  latestTime?: string
  query?: string
  relatedEntities?: InvestigationArtifact["relatedEntities"]
  resultCount?: number
  rows?: DatasourceSearchRow[]
  summary?: string
  title?: string
  vendor?: string
}

export async function GET(_request: Request, context: RouteContext) {
  const { roomId } = await context.params
  const authResult = await requireApiCasePermissionByRoomId(roomId, "view")

  if (authResult.error) {
    return authResult.error
  }

  const linkedInvestigation = await getInvestigationByRoomId(roomId)

  if (!linkedInvestigation) {
    return NextResponse.json([])
  }

  const resultSets = await listSavedDatasourceResultSets(roomId)

  return NextResponse.json(resultSets)
}

export async function POST(request: Request, context: RouteContext) {
  const { roomId } = await context.params
  const authResult = await requireApiCasePermissionByRoomId(roomId, "edit")

  if (authResult.error) {
    return authResult.error
  }

  const linkedInvestigation = await getInvestigationByRoomId(roomId)
  const payload = (await request.json()) as CreateSavedResultPayload

  if (!linkedInvestigation) {
    return NextResponse.json(
      {
        error:
          "Temporary rooms are not persisted. Link this workspace to a case before saving datasource results.",
      },
      { status: 409 },
    )
  }

  if (
    !payload.datasourceId?.trim() ||
    !payload.datasourceTitle?.trim() ||
    !payload.query?.trim() ||
    !payload.summary?.trim() ||
    !payload.title?.trim() ||
    !payload.vendor ||
    !Array.isArray(payload.rows) ||
    !payload.artifact
  ) {
    return NextResponse.json(
      {
        error:
          "datasourceId, datasourceTitle, vendor, query, title, summary, rows, and artifact are required.",
      },
      { status: 400 },
    )
  }

  try {
    const savedResultSet = await createSavedDatasourceResultSet({
      datasourceId: payload.datasourceId,
      datasourceTitle: payload.datasourceTitle,
      earliestTime: payload.earliestTime,
      id: payload.artifact.id,
      latestTime: payload.latestTime,
      query: payload.query,
      relatedEntities: payload.relatedEntities ?? [],
      resultCount: payload.resultCount ?? payload.rows.length,
      roomId,
      rows: payload.rows,
      summary: payload.summary,
      title: payload.title,
      vendor: payload.vendor,
    })

    await createRoomArtifact(roomId, payload.artifact)

    return NextResponse.json(savedResultSet)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to persist datasource result set.",
      },
      { status: 500 },
    )
  }
}

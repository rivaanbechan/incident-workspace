import { NextResponse } from "next/server"

import {
  forbiddenJson,
  requireApiCasePermissionByRoomId,
  requireApiOrgPermission,
} from "@/lib/auth/access"
import { getDatasourceAdapterByVendor } from "@/lib/datasources"
import { getStoredDatasourceById } from "@/lib/db/datasources"
import { getInvestigationById } from "@/lib/db/investigations"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: Request, context: RouteContext) {
  const integrationAccess = await requireApiOrgPermission("manage_integrations")
  const canManageIntegrations = Boolean(integrationAccess.user)

  if (integrationAccess.error && !canManageIntegrations) {
    return integrationAccess.error
  }

  const { id } = await context.params
  const datasource = await getStoredDatasourceById(id)

  if (!datasource) {
    return NextResponse.json({ error: "Datasource not found." }, { status: 404 })
  }

  if (!datasource.enabled) {
    return NextResponse.json({ error: "Datasource is disabled." }, { status: 400 })
  }

  const adapter = getDatasourceAdapterByVendor(datasource.vendor)

  if (!adapter) {
    return NextResponse.json(
      { error: `No datasource adapter is registered for vendor "${datasource.vendor}".` },
      { status: 400 },
    )
  }

  if (!adapter.definition.capabilities.supportsSearch || !adapter.executeSearch) {
    return NextResponse.json(
      { error: `Datasource vendor "${datasource.vendor}" does not support search.` },
      { status: 400 },
    )
  }

  const payload = (await request.json()) as {
    caseId?: string
    earliestTime?: string
    latestTime?: string
    limit?: number
    query?: string
  }

  if (payload.caseId?.trim()) {
    const investigation = await getInvestigationById(payload.caseId.trim())

    if (!investigation) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 })
    }

    const caseAccess = await requireApiCasePermissionByRoomId(investigation.roomId, "view")

    if (caseAccess.error) {
      return caseAccess.error
    }
  } else if (!canManageIntegrations) {
    return integrationAccess.error ?? forbiddenJson()
  }

  if (!payload.query?.trim()) {
    return NextResponse.json({ error: "A non-empty search query is required." }, { status: 400 })
  }

  if (payload.limit !== undefined && (!Number.isFinite(payload.limit) || payload.limit < 1)) {
    return NextResponse.json({ error: "limit must be a positive number." }, { status: 400 })
  }

  try {
    const result = await adapter.executeSearch(datasource, {
      earliestTime: payload.earliestTime,
      latestTime: payload.latestTime,
      limit: payload.limit,
      query: payload.query,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to execute datasource search.",
      },
      { status: 500 },
    )
  }
}

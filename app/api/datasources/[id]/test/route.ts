import { NextResponse } from "next/server"

import { requireApiOrgPermission } from "@/lib/auth/access"
import { getDatasourceAdapterByVendor } from "@/lib/datasources"
import { getStoredDatasourceById } from "@/lib/db/datasources"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(_request: Request, context: RouteContext) {
  const authResult = await requireApiOrgPermission("manage_integrations")

  if (authResult.error) {
    return authResult.error
  }

  const { id } = await context.params
  const datasource = await getStoredDatasourceById(id)

  if (!datasource) {
    return NextResponse.json({ error: "Datasource not found." }, { status: 404 })
  }

  const adapter = getDatasourceAdapterByVendor(datasource.vendor)

  if (!adapter) {
    return NextResponse.json(
      { error: `No datasource adapter is registered for vendor "${datasource.vendor}".` },
      { status: 400 },
    )
  }

  if (!adapter.definition.capabilities.supportsHealthcheck || !adapter.testConnection) {
    return NextResponse.json(
      { error: `Datasource vendor "${datasource.vendor}" does not support health checks.` },
      { status: 400 },
    )
  }

  try {
    const status = await adapter.testConnection(datasource)
    return NextResponse.json(status)
  } catch (error) {
    return NextResponse.json(
      {
        checkedAt: new Date().toISOString(),
        error:
          error instanceof Error ? error.message : "Unable to test datasource connection.",
        ok: false,
      },
      { status: 500 },
    )
  }
}

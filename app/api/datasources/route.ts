import { NextResponse } from "next/server"

import { getCurrentUser, requireApiOrgPermission, unauthorizedJson } from "@/lib/auth/access"
import { getDatasourceAdapterByVendor, listDatasourceDefinitions } from "@/lib/datasources"
import { getStoredDatasourceById, listDatasources, upsertDatasource } from "@/lib/db/datasources"

export async function GET() {
  const user = await getCurrentUser()

  if (!user) {
    return unauthorizedJson()
  }

  const [datasources, definitions] = await Promise.all([
    listDatasources(),
    Promise.resolve(listDatasourceDefinitions()),
  ])

  return NextResponse.json({
    datasources,
    definitions,
  })
}

export async function POST(request: Request) {
  const authResult = await requireApiOrgPermission("manage_integrations")

  if (authResult.error) {
    return authResult.error
  }

  const payload = (await request.json()) as {
    baseUrl?: string
    config?: Record<string, unknown>
    enabled?: boolean
    id?: string
    title?: string
    vendor?: string
  }

  if (!payload.baseUrl?.trim() || !payload.title?.trim() || !payload.vendor?.trim()) {
    return NextResponse.json(
      { error: "baseUrl, title, and vendor are required." },
      { status: 400 },
    )
  }

  try {
    const adapter = getDatasourceAdapterByVendor(payload.vendor)

    if (!adapter) {
      return NextResponse.json(
        { error: `No datasource adapter is registered for vendor "${payload.vendor}".` },
        { status: 400 },
      )
    }

    const existingDatasource = payload.id
      ? await getStoredDatasourceById(payload.id)
      : null
    const nextConfig = adapter.validateConfig(payload.config ?? {}, {
      existingConfig: existingDatasource?.config ?? null,
    })

    const datasource = await upsertDatasource({
      baseUrl: payload.baseUrl,
      config: nextConfig,
      enabled: payload.enabled,
      id: payload.id,
      title: payload.title,
      vendor: payload.vendor,
    })

    return NextResponse.json(datasource)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save datasource configuration.",
      },
      { status: 500 },
    )
  }
}

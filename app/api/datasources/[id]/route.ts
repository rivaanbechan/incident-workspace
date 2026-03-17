import { NextResponse } from "next/server"

import { requireApiOrgPermission } from "@/lib/auth/access"
import { deleteDatasource, getStoredDatasourceById } from "@/lib/db/datasources"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireApiOrgPermission("manage_integrations")

  if (authResult.error) {
    return authResult.error
  }

  const { id } = await context.params
  const datasource = await getStoredDatasourceById(id)

  if (!datasource) {
    return NextResponse.json({ error: "Datasource not found." }, { status: 404 })
  }

  return NextResponse.json(datasource)
}

export async function DELETE(_request: Request, context: RouteContext) {
  const authResult = await requireApiOrgPermission("manage_integrations")

  if (authResult.error) {
    return authResult.error
  }

  const { id } = await context.params
  const datasource = await getStoredDatasourceById(id)

  if (!datasource) {
    return NextResponse.json({ error: "Datasource not found." }, { status: 404 })
  }

  try {
    const deletedId = await deleteDatasource(id)

    return NextResponse.json({
      deletedId,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to delete datasource instance.",
      },
      { status: 500 },
    )
  }
}

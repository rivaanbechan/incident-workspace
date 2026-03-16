import { NextResponse } from "next/server"

import { requireApiCasePermissionByCaseId } from "@/lib/auth/access"
import { getInvestigationById } from "@/lib/db/investigations"
import { getInvestigationEntityDetail } from "@/lib/db/investigationEntities"

type RouteContext = {
  params: Promise<{
    caseId: string
    entityId: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { caseId, entityId } = await context.params
  const authResult = await requireApiCasePermissionByCaseId(caseId, "view")

  if (authResult.error) {
    return authResult.error
  }

  const investigation = await getInvestigationById(caseId)

  if (!investigation) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 })
  }

  const entity = await getInvestigationEntityDetail(caseId, entityId)

  if (!entity) {
    return NextResponse.json({ error: "Entity not found." }, { status: 404 })
  }

  return NextResponse.json(entity)
}

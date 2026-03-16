import { NextResponse } from "next/server"

import { requireApiCasePermissionByCaseId } from "@/lib/auth/access"
import { getInvestigationById } from "@/lib/db/investigations"
import {
  listInvestigationEntitySummaries,
  upsertInvestigationEntity,
} from "@/lib/db/investigationEntities"
import type { InvestigationEntityKind } from "@/lib/contracts/investigationEntities"

type RouteContext = {
  params: Promise<{
    caseId: string
  }>
}

function isValidKind(value: string) {
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

export async function GET(_request: Request, context: RouteContext) {
  const { caseId } = await context.params
  const authResult = await requireApiCasePermissionByCaseId(caseId, "view")

  if (authResult.error) {
    return authResult.error
  }

  const investigation = await getInvestigationById(caseId)

  if (!investigation) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 })
  }

  const entities = await listInvestigationEntitySummaries(caseId)
  return NextResponse.json(entities)
}

export async function POST(request: Request, context: RouteContext) {
  const { caseId } = await context.params
  const authResult = await requireApiCasePermissionByCaseId(caseId, "edit")

  if (authResult.error) {
    return authResult.error
  }

  const investigation = await getInvestigationById(caseId)

  if (!investigation) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 })
  }

  const payload = (await request.json()) as {
    entity?: {
      id?: string
      kind?: string
      label?: string
      payload?: Record<string, unknown>
      value?: string
    }
  }

  const entity = payload.entity

  if (!entity) {
    return NextResponse.json({ error: "Entity payload is required." }, { status: 400 })
  }

  const value = (entity.value ?? entity.id ?? "").trim()
  const label = (entity.label ?? value).trim()

  if (!value || !label || !entity.kind || !isValidKind(entity.kind)) {
    return NextResponse.json(
      { error: "Entity kind, value, and label are required." },
      { status: 400 },
    )
  }

  try {
    const created = await upsertInvestigationEntity(caseId, {
      kind: entity.kind as InvestigationEntityKind,
      label,
      payload:
        entity.payload && typeof entity.payload === "object" && !Array.isArray(entity.payload)
          ? entity.payload
          : {},
      value,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create entity." },
      { status: 500 },
    )
  }
}

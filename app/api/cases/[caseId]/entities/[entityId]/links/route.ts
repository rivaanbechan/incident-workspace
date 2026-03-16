import { NextResponse } from "next/server"

import { requireApiCasePermissionByCaseId } from "@/lib/auth/access"
import { getInvestigationById } from "@/lib/db/investigations"
import {
  linkInvestigationEntity,
  unlinkInvestigationEntity,
} from "@/lib/db/investigationEntities"

type RouteContext = {
  params: Promise<{
    caseId: string
    entityId: string
  }>
}

function isValidTargetKind(value: string) {
  return value === "artifact" || value === "case-record" || value === "evidence-set"
}

export async function POST(request: Request, context: RouteContext) {
  const { caseId, entityId } = await context.params
  const authResult = await requireApiCasePermissionByCaseId(caseId, "edit")

  if (authResult.error) {
    return authResult.error
  }

  const investigation = await getInvestigationById(caseId)

  if (!investigation) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 })
  }

  const payload = (await request.json()) as {
    targetId?: string
    targetKind?: string
  }

  if (!payload.targetId?.trim() || !payload.targetKind || !isValidTargetKind(payload.targetKind)) {
    return NextResponse.json({ error: "Valid targetKind and targetId are required." }, { status: 400 })
  }

  try {
    await linkInvestigationEntity(caseId, entityId, payload.targetKind, payload.targetId.trim())
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to link entity." },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { caseId, entityId } = await context.params
  const authResult = await requireApiCasePermissionByCaseId(caseId, "edit")

  if (authResult.error) {
    return authResult.error
  }

  const investigation = await getInvestigationById(caseId)

  if (!investigation) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 })
  }

  const payload = (await request.json()) as {
    targetId?: string
    targetKind?: string
  }

  if (!payload.targetId?.trim() || !payload.targetKind || !isValidTargetKind(payload.targetKind)) {
    return NextResponse.json({ error: "Valid targetKind and targetId are required." }, { status: 400 })
  }

  try {
    await unlinkInvestigationEntity(caseId, entityId, payload.targetKind, payload.targetId.trim())
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to unlink entity." },
      { status: 500 },
    )
  }
}

import { NextResponse } from "next/server"

import { requireApiCasePermissionByCaseId } from "@/lib/auth/access"
import type {
  InvestigationCaseRecordPayload,
} from "@/lib/contracts/caseRecords"
import type { EntityRef } from "@/lib/contracts/entities"
import {
  isValidCaseRecordKind,
  isValidCaseRecordSourceType,
  normalizeEntityRefs,
  normalizeRecordPayload,
} from "@/lib/contracts/validations"
import {
  createInvestigationCaseRecord,
  listInvestigationCaseRecords,
} from "@/lib/db/caseRecords"
import { getInvestigationById } from "@/lib/db/investigations"

type RouteContext = {
  params: Promise<{
    caseId: string
  }>
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

  const records = await listInvestigationCaseRecords(caseId)
  return NextResponse.json(records)
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
    record?: {
      deepLink?: { href: string; moduleId: string }
      kind?: string
      payload?: InvestigationCaseRecordPayload
      relatedEntities?: EntityRef[]
      sourceId?: string
      sourceModule?: string
      sourceRoomId?: string
      sourceType?: string
      summary?: string
      title?: string
    }
  }

  const record = payload.record

  if (!record) {
    return NextResponse.json({ error: "A case record is required." }, { status: 400 })
  }

  if (!record.title?.trim() || !record.summary?.trim()) {
    return NextResponse.json(
      { error: "Case records require both title and summary." },
      { status: 400 },
    )
  }

  if (!record.kind || !isValidCaseRecordKind(record.kind)) {
    return NextResponse.json({ error: "Invalid case record kind." }, { status: 400 })
  }

  if (!record.sourceType || !isValidCaseRecordSourceType(record.sourceType)) {
    return NextResponse.json({ error: "Invalid case record source type." }, { status: 400 })
  }

  if (!record.sourceId?.trim() || !record.sourceModule?.trim() || !record.sourceRoomId?.trim()) {
    return NextResponse.json(
      { error: "Case record provenance is required." },
      { status: 400 },
    )
  }

  try {
    const created = await createInvestigationCaseRecord({
      deepLink: record.deepLink,
      investigationId: caseId,
      kind: record.kind,
      payload: normalizeRecordPayload(record.payload),
      relatedEntities: normalizeEntityRefs(record.relatedEntities),
      sourceId: record.sourceId,
      sourceModule: record.sourceModule,
      sourceRoomId: record.sourceRoomId,
      sourceType: record.sourceType,
      summary: record.summary.trim(),
      title: record.title.trim(),
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create case record." },
      { status: 500 },
    )
  }
}

import { NextResponse } from "next/server"

import { requireApiCasePermissionByCaseId } from "@/lib/auth/access"
import type {
  InvestigationCaseRecordKind,
  InvestigationCaseRecordPayload,
  InvestigationCaseRecordSourceType,
} from "@/lib/contracts/caseRecords"
import type { EntityRef } from "@/lib/contracts/entities"
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

function isValidKind(value: string): value is InvestigationCaseRecordKind {
  return (
    value === "action" ||
    value === "decision" ||
    value === "evidence" ||
    value === "finding" ||
    value === "hypothesis" ||
    value === "timeline-event"
  )
}

function isValidSourceType(value: string): value is InvestigationCaseRecordSourceType {
  return (
    value === "action-item" ||
    value === "artifact" ||
    value === "case-record" ||
    value === "evidence-set" ||
    value === "incident-card" ||
    value === "note" ||
    value === "timeline-entry"
  )
}

function normalizeEntityRefs(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is EntityRef => {
    return (
      typeof item === "object" &&
      item !== null &&
      typeof (item as EntityRef).id === "string" &&
      typeof (item as EntityRef).kind === "string" &&
      typeof (item as EntityRef).label === "string"
    )
  })
}

function normalizePayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as InvestigationCaseRecordPayload
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

  if (!record.kind || !isValidKind(record.kind)) {
    return NextResponse.json({ error: "Invalid case record kind." }, { status: 400 })
  }

  if (!record.sourceType || !isValidSourceType(record.sourceType)) {
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
      payload: normalizePayload(record.payload),
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

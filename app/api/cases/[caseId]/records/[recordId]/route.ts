import { NextResponse } from "next/server"

import { requireApiCasePermissionByCaseId } from "@/lib/auth/access"
import type {
  InvestigationCaseRecordKind,
  InvestigationCaseRecordPayload,
} from "@/lib/contracts/caseRecords"
import type { EntityRef } from "@/lib/contracts/entities"
import {
  deleteInvestigationCaseRecord,
  getInvestigationCaseRecord,
  updateInvestigationCaseRecord,
} from "@/lib/db/caseRecords"
import { getInvestigationById } from "@/lib/db/investigations"

type RouteContext = {
  params: Promise<{
    caseId: string
    recordId: string
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

export async function PATCH(request: Request, context: RouteContext) {
  const { caseId, recordId } = await context.params
  const authResult = await requireApiCasePermissionByCaseId(caseId, "edit")

  if (authResult.error) {
    return authResult.error
  }

  const investigation = await getInvestigationById(caseId)

  if (!investigation) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 })
  }

  const existing = await getInvestigationCaseRecord(caseId, recordId)

  if (!existing) {
    return NextResponse.json({ error: "Case record not found." }, { status: 404 })
  }

  const payload = (await request.json()) as {
    record?: {
      deepLink?: { href: string; moduleId: string }
      kind?: string
      payload?: InvestigationCaseRecordPayload
      relatedEntities?: EntityRef[]
      summary?: string
      title?: string
    }
  }

  const record = payload.record

  if (!record?.title?.trim() || !record.summary?.trim() || !record.kind) {
    return NextResponse.json({ error: "Title, summary, and kind are required." }, { status: 400 })
  }

  if (!isValidKind(record.kind)) {
    return NextResponse.json({ error: "Invalid case record kind." }, { status: 400 })
  }

  try {
    const updated = await updateInvestigationCaseRecord(caseId, recordId, {
      deepLink: record.deepLink,
      kind: record.kind,
      payload: normalizePayload(record.payload),
      relatedEntities: normalizeEntityRefs(record.relatedEntities),
      summary: record.summary.trim(),
      title: record.title.trim(),
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update case record." },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { caseId, recordId } = await context.params
  const authResult = await requireApiCasePermissionByCaseId(caseId, "edit")

  if (authResult.error) {
    return authResult.error
  }

  try {
    await deleteInvestigationCaseRecord(caseId, recordId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete case record." },
      { status: 500 },
    )
  }
}

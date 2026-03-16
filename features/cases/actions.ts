"use server"

import type {
  InvestigationSeverity,
  InvestigationStatus,
} from "@/lib/contracts/investigations"
import type { InvestigationEntityKind } from "@/lib/contracts/investigationEntities"
import { hasOrgPermission } from "@/lib/auth/permissions"
import { getCurrentUser } from "@/lib/auth/access"
import { getCaseMembership, upsertCaseMembership } from "@/lib/db/auth"
import {
  deleteInvestigationCaseRecord,
  deleteInvestigationCaseRecords,
} from "@/lib/db/caseRecords"
import { deleteSavedDatasourceResultSets } from "@/lib/db/datasourceResults"
import { deleteRoomDocument } from "@/lib/db/roomDocuments"
import {
  archiveInvestigation,
  createInvestigation,
  deleteInvestigationRecord,
  getInvestigationById,
  restoreInvestigation,
  updateInvestigation,
} from "@/lib/db/investigations"
import { deleteRoomArtifacts } from "@/lib/db/artifacts"
import {
  linkInvestigationEntity,
  unlinkInvestigationEntity,
  upsertInvestigationEntity,
} from "@/lib/db/investigationEntities"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { deleteSavedHuntGraphViews } from "@/features/collab-hunt-graph/lib/storage"
import { getCaseDetailHref, getCasesHref } from "@/features/cases/manifest"

function readField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim()
}

function isValidEntityKind(value: string): value is InvestigationEntityKind {
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

async function requireCurrentUser() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return user
}

async function requireCreateCaseUser() {
  const user = await requireCurrentUser()

  if (!hasOrgPermission(user.orgRole, "create_case") && user.orgRole !== "org_admin") {
    redirect("/unauthorized")
  }

  return user
}

async function requireCaseEditor(caseId: string) {
  const user = await requireCurrentUser()

  if (user.orgRole === "org_admin") {
    return user
  }

  const membership = await getCaseMembership(caseId, user.id)

  if (!membership || (membership.role !== "case_editor" && membership.role !== "case_owner")) {
    redirect("/unauthorized")
  }

  return user
}

export async function createCaseAction(formData: FormData) {
  const user = await requireCreateCaseUser()
  const title = readField(formData, "title")
  const summary = readField(formData, "summary")
  const severity = readField(formData, "severity") as InvestigationSeverity

  if (!title) {
    return
  }

  const created = await createInvestigation({
    owner: user.name,
    severity: severity || "high",
    summary,
    title,
  })

  if (!created) {
    return
  }

  await upsertCaseMembership({
    caseId: created.id,
    role: "case_owner",
    userId: user.id,
  })

  revalidatePath(getCasesHref())
  redirect(getCaseDetailHref(created.id))
}

export async function updateCaseMetadataAction(formData: FormData) {
  const investigationId = readField(formData, "caseId")

  if (!investigationId) {
    return
  }

  await requireCaseEditor(investigationId)

  await updateInvestigation(investigationId, {
    owner: readField(formData, "owner"),
    severity: readField(formData, "severity") as InvestigationSeverity,
    status: readField(formData, "status") as InvestigationStatus,
    summary: readField(formData, "summary"),
    title: readField(formData, "title"),
  })

  revalidatePath(getCasesHref())
  revalidatePath(getCaseDetailHref(investigationId))
}

export async function archiveCaseAction(formData: FormData) {
  const investigationId = readField(formData, "caseId")

  if (!investigationId) {
    return
  }

  await requireCaseEditor(investigationId)

  await archiveInvestigation(investigationId)

  revalidatePath(getCasesHref())
  revalidatePath(getCaseDetailHref(investigationId))
}

export async function restoreCaseAction(formData: FormData) {
  const investigationId = readField(formData, "caseId")

  if (!investigationId) {
    return
  }

  await requireCaseEditor(investigationId)

  await restoreInvestigation(investigationId)

  revalidatePath(getCasesHref())
  revalidatePath(getCaseDetailHref(investigationId))
}

export async function deleteCasePermanentlyAction(formData: FormData) {
  const investigationId = readField(formData, "caseId")
  const confirmation = readField(formData, "confirmation")

  if (!investigationId || confirmation !== "DELETE") {
    return
  }

  await requireCaseEditor(investigationId)

  const investigation = await getInvestigationById(investigationId)

  if (!investigation) {
    redirect(getCasesHref())
  }

  await deleteRoomArtifacts(investigation.roomId)
  await deleteInvestigationCaseRecords(investigationId)
  await deleteSavedHuntGraphViews(investigation.roomId)
  await deleteSavedDatasourceResultSets(investigation.roomId)
  await deleteRoomDocument(investigation.roomId)
  await deleteRoomDocument(`hunt:${investigation.roomId}`)
  await deleteInvestigationRecord(investigationId)

  revalidatePath(getCasesHref())
  redirect(getCasesHref())
}

export async function removeCaseRecordAction(formData: FormData) {
  const investigationId = readField(formData, "caseId")
  const recordId = readField(formData, "recordId")

  if (!investigationId || !recordId) {
    return
  }

  await requireCaseEditor(investigationId)

  await deleteInvestigationCaseRecord(investigationId, recordId)

  revalidatePath(getCasesHref())
  revalidatePath(getCaseDetailHref(investigationId))
}

export async function createInvestigationEntityAction(formData: FormData) {
  const investigationId = readField(formData, "caseId")
  const kind = readField(formData, "kind")
  const label = readField(formData, "label")
  const value = readField(formData, "value")

  if (!investigationId || !value || !label || !isValidEntityKind(kind)) {
    return
  }

  await requireCaseEditor(investigationId)

  await upsertInvestigationEntity(investigationId, {
    kind,
    label,
    value,
  })

  revalidatePath(getCasesHref())
  revalidatePath(getCaseDetailHref(investigationId))
}

export async function linkInvestigationEntityAction(formData: FormData) {
  const investigationId = readField(formData, "caseId")
  const entityId = readField(formData, "entityId")
  const targetId = readField(formData, "targetId")
  const targetKind = readField(formData, "targetKind")

  if (
    !investigationId ||
    !entityId ||
    !targetId ||
    (targetKind !== "artifact" && targetKind !== "case-record" && targetKind !== "evidence-set")
  ) {
    return
  }

  await requireCaseEditor(investigationId)

  await linkInvestigationEntity(investigationId, entityId, targetKind, targetId)

  revalidatePath(getCasesHref())
  revalidatePath(getCaseDetailHref(investigationId))
}

export async function unlinkInvestigationEntityAction(formData: FormData) {
  const investigationId = readField(formData, "caseId")
  const entityId = readField(formData, "entityId")
  const targetId = readField(formData, "targetId")
  const targetKind = readField(formData, "targetKind")

  if (
    !investigationId ||
    !entityId ||
    !targetId ||
    (targetKind !== "artifact" && targetKind !== "case-record" && targetKind !== "evidence-set")
  ) {
    return
  }

  await requireCaseEditor(investigationId)

  await unlinkInvestigationEntity(investigationId, entityId, targetKind, targetId)

  revalidatePath(getCasesHref())
  revalidatePath(getCaseDetailHref(investigationId))
}

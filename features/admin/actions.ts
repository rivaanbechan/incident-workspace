"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import type { CaseRole, OrgRole } from "@/lib/auth/permissions"
import { hasCasePermission, hasOrgPermission } from "@/lib/auth/permissions"
import { getCurrentUser } from "@/lib/auth/access"
import {
  createOrganizationUser,
  deleteCaseMembership,
  getCaseMembership,
  getUserByEmail,
  updateOrganizationMembershipRole,
  upsertCaseMembership,
} from "@/lib/db/auth"

function readField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim()
}

async function requireOrgAdmin() {
  const user = await getCurrentUser()

  if (!user || !hasOrgPermission(user.orgRole, "manage_org_memberships")) {
    redirect("/unauthorized")
  }

  return user
}

export async function createOrganizationUserAction(formData: FormData) {
  await requireOrgAdmin()

  const email = readField(formData, "email").toLowerCase()
  const name = readField(formData, "name")
  const password = readField(formData, "password")
  const orgRole = readField(formData, "orgRole") as OrgRole

  if (!email || !name || !password) {
    return
  }

  if (!["integration_admin", "investigator", "org_admin", "viewer"].includes(orgRole)) {
    return
  }

  await createOrganizationUser({ email, name, orgRole, password })
  revalidatePath("/admin")
}

export async function updateOrganizationRoleAction(formData: FormData) {
  await requireOrgAdmin()

  const userId = readField(formData, "userId")
  const orgRole = readField(formData, "orgRole") as OrgRole

  if (!userId || !["integration_admin", "investigator", "org_admin", "viewer"].includes(orgRole)) {
    return
  }

  await updateOrganizationMembershipRole(userId, orgRole)
  revalidatePath("/admin")
}

async function requireCaseMembershipManager(caseId: string) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  if (user.orgRole === "org_admin") {
    return user
  }

  const membership = await getCaseMembership(caseId, user.id)

  if (!membership || !hasCasePermission({ caseRole: membership.role, orgRole: user.orgRole }, "manage_members")) {
    redirect("/unauthorized")
  }

  return user
}

export async function upsertCaseMembershipAction(formData: FormData) {
  const caseId = readField(formData, "caseId")
  const email = readField(formData, "email").toLowerCase()
  const role = readField(formData, "role") as CaseRole

  if (!caseId || !email || !["case_editor", "case_owner", "case_viewer"].includes(role)) {
    return
  }

  await requireCaseMembershipManager(caseId)

  const user = await getUserByEmail(email)

  if (!user) {
    throw new Error("User not found.")
  }

  await upsertCaseMembership({ caseId, role, userId: user.id })
  revalidatePath(`/cases/${caseId}`)
}

export async function removeCaseMembershipAction(formData: FormData) {
  const caseId = readField(formData, "caseId")
  const userId = readField(formData, "userId")

  if (!caseId || !userId) {
    return
  }

  await requireCaseMembershipManager(caseId)
  await deleteCaseMembership(caseId, userId)
  revalidatePath(`/cases/${caseId}`)
}

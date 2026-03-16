export type OrgRole = "integration_admin" | "investigator" | "org_admin" | "viewer"

export type CaseRole = "case_editor" | "case_owner" | "case_viewer"

export type OrgPermission =
  | "create_case"
  | "manage_integrations"
  | "manage_org_memberships"
  | "view_admin"
  | "view_all_cases"

export type CasePermission = "edit" | "manage_members" | "view"

export type AuthenticatedUser = {
  color: string
  email: string
  id: string
  name: string
  orgId: string
  orgRole: OrgRole
}

export type CaseAccessContext = AuthenticatedUser & {
  caseId: string | null
  caseRole: CaseRole | null
  roomId: string | null
}

const ORG_PERMISSION_MATRIX: Record<OrgRole, ReadonlySet<OrgPermission>> = {
  integration_admin: new Set(["manage_integrations", "view_all_cases"]),
  investigator: new Set(["create_case"]),
  org_admin: new Set([
    "create_case",
    "manage_integrations",
    "manage_org_memberships",
    "view_admin",
    "view_all_cases",
  ]),
  viewer: new Set([]),
}

const CASE_PERMISSION_MATRIX: Record<CaseRole, ReadonlySet<CasePermission>> = {
  case_editor: new Set(["edit", "view"]),
  case_owner: new Set(["edit", "manage_members", "view"]),
  case_viewer: new Set(["view"]),
}

export function hasOrgPermission(role: OrgRole, permission: OrgPermission) {
  return ORG_PERMISSION_MATRIX[role].has(permission)
}

export function hasCasePermission(
  access: Pick<CaseAccessContext, "caseRole" | "orgRole">,
  permission: CasePermission,
) {
  if (access.orgRole === "org_admin") {
    return true
  }

  if (permission === "view" && access.orgRole === "integration_admin") {
    return true
  }

  if (!access.caseRole) {
    return false
  }

  return CASE_PERMISSION_MATRIX[access.caseRole].has(permission)
}

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  integration_admin: "Integration Admin",
  investigator: "Investigator",
  org_admin: "Org Admin",
  viewer: "Viewer",
}

export const CASE_ROLE_LABELS: Record<CaseRole, string> = {
  case_editor: "Case Editor",
  case_owner: "Case Owner",
  case_viewer: "Case Viewer",
}

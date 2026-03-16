import { describe, it, expect } from "vitest"
import {
  hasCasePermission,
  hasOrgPermission,
} from "@/lib/auth/permissions"
import type { CaseAccessContext } from "@/lib/auth/permissions"

describe("hasOrgPermission", () => {
  it("grants org_admin all permissions", () => {
    expect(hasOrgPermission("org_admin", "create_case")).toBe(true)
    expect(hasOrgPermission("org_admin", "manage_integrations")).toBe(true)
    expect(hasOrgPermission("org_admin", "manage_org_memberships")).toBe(true)
    expect(hasOrgPermission("org_admin", "view_admin")).toBe(true)
    expect(hasOrgPermission("org_admin", "view_all_cases")).toBe(true)
  })

  it("grants investigator only create_case", () => {
    expect(hasOrgPermission("investigator", "create_case")).toBe(true)
    expect(hasOrgPermission("investigator", "manage_integrations")).toBe(false)
    expect(hasOrgPermission("investigator", "view_admin")).toBe(false)
  })

  it("grants integration_admin manage_integrations and view_all_cases", () => {
    expect(hasOrgPermission("integration_admin", "manage_integrations")).toBe(true)
    expect(hasOrgPermission("integration_admin", "view_all_cases")).toBe(true)
    expect(hasOrgPermission("integration_admin", "create_case")).toBe(false)
    expect(hasOrgPermission("integration_admin", "manage_org_memberships")).toBe(false)
  })

  it("grants viewer no permissions", () => {
    expect(hasOrgPermission("viewer", "create_case")).toBe(false)
    expect(hasOrgPermission("viewer", "manage_integrations")).toBe(false)
    expect(hasOrgPermission("viewer", "view_all_cases")).toBe(false)
  })
})

describe("hasCasePermission", () => {
  const makeAccess = (
    orgRole: CaseAccessContext["orgRole"],
    caseRole: CaseAccessContext["caseRole"],
  ) => ({ orgRole, caseRole })

  it("grants org_admin all case permissions regardless of caseRole", () => {
    const access = makeAccess("org_admin", null)

    expect(hasCasePermission(access, "view")).toBe(true)
    expect(hasCasePermission(access, "edit")).toBe(true)
    expect(hasCasePermission(access, "manage_members")).toBe(true)
  })

  it("grants integration_admin view permission", () => {
    const access = makeAccess("integration_admin", null)

    expect(hasCasePermission(access, "view")).toBe(true)
    expect(hasCasePermission(access, "edit")).toBe(false)
  })

  it("returns false when caseRole is null for non-admin org roles", () => {
    const access = makeAccess("investigator", null)

    expect(hasCasePermission(access, "view")).toBe(false)
    expect(hasCasePermission(access, "edit")).toBe(false)
  })

  it("grants case_owner all case permissions", () => {
    const access = makeAccess("investigator", "case_owner")

    expect(hasCasePermission(access, "view")).toBe(true)
    expect(hasCasePermission(access, "edit")).toBe(true)
    expect(hasCasePermission(access, "manage_members")).toBe(true)
  })

  it("grants case_editor edit and view but not manage_members", () => {
    const access = makeAccess("investigator", "case_editor")

    expect(hasCasePermission(access, "view")).toBe(true)
    expect(hasCasePermission(access, "edit")).toBe(true)
    expect(hasCasePermission(access, "manage_members")).toBe(false)
  })

  it("grants case_viewer only view", () => {
    const access = makeAccess("investigator", "case_viewer")

    expect(hasCasePermission(access, "view")).toBe(true)
    expect(hasCasePermission(access, "edit")).toBe(false)
    expect(hasCasePermission(access, "manage_members")).toBe(false)
  })
})

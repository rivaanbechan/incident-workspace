import { describe, expect, it } from "vitest"

import {
  getDefaultRoles,
  getPermissionsByDomain,
  PERMISSION_REGISTRY,
} from "@/lib/auth/permissionRegistry"

describe("PERMISSION_REGISTRY", () => {
  it("contains all expected permissions", () => {
    const ids = Object.keys(PERMISSION_REGISTRY)

    expect(ids).toContain("cases:view")
    expect(ids).toContain("board:edit")
    expect(ids).toContain("agents:manage")
    expect(ids).toContain("oracle:contribute")
    expect(ids).toContain("integrations:manage")
    expect(ids).toContain("investigations:manage")
    expect(ids).toContain("admin:manage_roles")
  })

  it("every definition has required fields", () => {
    for (const def of Object.values(PERMISSION_REGISTRY)) {
      expect(def.id).toBeTruthy()
      expect(def.label).toBeTruthy()
      expect(def.description).toBeTruthy()
      expect(["org", "case"]).toContain(def.axis)
      expect(Array.isArray(def.defaultRoles)).toBe(true)
      expect(typeof def.systemManaged).toBe("boolean")
    }
  })

  it("registry key matches definition id", () => {
    for (const [key, def] of Object.entries(PERMISSION_REGISTRY)) {
      expect(key).toBe(def.id)
    }
  })

  it("marks admin:view and admin:manage_members as system-managed", () => {
    expect(PERMISSION_REGISTRY["admin:view"].systemManaged).toBe(true)
    expect(PERMISSION_REGISTRY["admin:manage_members"].systemManaged).toBe(true)
    expect(PERMISSION_REGISTRY["admin:manage_roles"].systemManaged).toBe(false)
  })

  it("org-level permissions have org_admin in defaultRoles", () => {
    const orgPerms = Object.values(PERMISSION_REGISTRY).filter(
      (def) => def.axis === "org" && def.defaultRoles.length > 0,
    )

    for (const def of orgPerms) {
      if (def.id === "integrations:manage") {
        expect(def.defaultRoles).toContain("integration_admin")
      }
    }
  })
})

describe("getPermissionsByDomain", () => {
  it("returns all domains", () => {
    const grouped = getPermissionsByDomain()
    const domains = Object.keys(grouped)

    expect(domains).toContain("cases")
    expect(domains).toContain("board")
    expect(domains).toContain("agents")
    expect(domains).toContain("oracle")
    expect(domains).toContain("integrations")
    expect(domains).toContain("investigations")
    expect(domains).toContain("admin")
  })

  it("groups permissions correctly", () => {
    const grouped = getPermissionsByDomain()

    for (const [domain, defs] of Object.entries(grouped)) {
      for (const def of defs) {
        expect(def.domain).toBe(domain)
      }
    }
  })

  it("every permission appears in exactly one domain group", () => {
    const grouped = getPermissionsByDomain()
    const allIds = Object.values(grouped).flatMap((defs) => defs.map((d) => d.id))
    const unique = new Set(allIds)

    expect(allIds.length).toBe(unique.size)
    expect(allIds.length).toBe(Object.keys(PERMISSION_REGISTRY).length)
  })
})

describe("getDefaultRoles", () => {
  it("returns defaultRoles for a known permission", () => {
    const roles = getDefaultRoles("oracle:contribute")
    expect(roles).toContain("org_admin")
    expect(roles).toContain("investigator")
    expect(roles).not.toContain("viewer")
  })

  it("returns empty array for unknown permission", () => {
    expect(getDefaultRoles("nonexistent:permission")).toEqual([])
  })

  it("returns all roles for view-type permissions", () => {
    const roles = getDefaultRoles("oracle:view")
    expect(roles).toContain("org_admin")
    expect(roles).toContain("investigator")
    expect(roles).toContain("integration_admin")
    expect(roles).toContain("viewer")
  })
})

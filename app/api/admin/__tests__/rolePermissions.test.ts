import { describe, expect, it, vi } from "vitest"

import { GET, PATCH } from "../roles/[roleName]/permissions/route"

vi.mock("@/lib/auth/access", () => ({
  requireApiAdminPermission: vi.fn().mockResolvedValue({
    error: null,
    user: { id: "user-1", orgId: "org-default", orgRole: "org_admin" },
  }),
}))

vi.mock("@/lib/db/roles", () => ({
  getPermissionsForRole: vi.fn().mockResolvedValue({
    "oracle:view": { granted: true, source: "default" },
    "oracle:contribute": { granted: false, source: "default" },
    "admin:manage_roles": { granted: true, source: "default" },
  }),
  setPermission: vi.fn().mockResolvedValue(undefined),
  resetPermission: vi.fn().mockResolvedValue(undefined),
}))

function makeContext(roleName: string) {
  return { params: Promise.resolve({ roleName }) }
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/admin/roles/viewer/permissions", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("GET /api/admin/roles/[roleName]/permissions", () => {
  it("returns resolved permissions", async () => {
    const req = new Request("http://localhost")
    const res = await GET(req, makeContext("viewer"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body["oracle:view"]).toBeDefined()
    expect(body["oracle:view"].granted).toBe(true)
  })
})

describe("PATCH /api/admin/roles/[roleName]/permissions", () => {
  it("grants a permission", async () => {
    const { setPermission } = await import("@/lib/db/roles")
    const req = makeRequest({ permissionId: "oracle:contribute", granted: true })
    const res = await PATCH(req, makeContext("viewer"))
    expect(res.status).toBe(200)
    expect(setPermission).toHaveBeenCalledWith(
      "org-default",
      "viewer",
      "oracle:contribute",
      true,
      "user-1",
    )
  })

  it("revokes a permission", async () => {
    const { setPermission } = await import("@/lib/db/roles")
    const req = makeRequest({ permissionId: "oracle:view", granted: false })
    const res = await PATCH(req, makeContext("viewer"))
    expect(res.status).toBe(200)
    expect(setPermission).toHaveBeenCalledWith(
      "org-default",
      "viewer",
      "oracle:view",
      false,
      "user-1",
    )
  })

  it("resets a permission to default when granted is null", async () => {
    const { resetPermission } = await import("@/lib/db/roles")
    const req = makeRequest({ permissionId: "oracle:view", granted: null })
    const res = await PATCH(req, makeContext("viewer"))
    expect(res.status).toBe(200)
    expect(resetPermission).toHaveBeenCalledWith("org-default", "viewer", "oracle:view")
  })

  it("returns 400 when permissionId is missing", async () => {
    const req = makeRequest({ granted: true })
    const res = await PATCH(req, makeContext("viewer"))
    expect(res.status).toBe(400)
  })

  it("returns 400 when permissionId is unknown", async () => {
    const req = makeRequest({ permissionId: "nonexistent:perm", granted: true })
    const res = await PATCH(req, makeContext("viewer"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Unknown/)
  })

  it("returns 403 when permission is system-managed", async () => {
    const req = makeRequest({ permissionId: "admin:view", granted: false })
    const res = await PATCH(req, makeContext("org_admin"))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/system-managed/)
  })

  it("returns 400 when granted field is missing", async () => {
    const req = makeRequest({ permissionId: "oracle:contribute" })
    const res = await PATCH(req, makeContext("viewer"))
    expect(res.status).toBe(400)
  })
})

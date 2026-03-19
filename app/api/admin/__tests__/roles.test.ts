import { describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

import { GET, POST } from "../roles/route"

vi.mock("@/lib/auth/access", () => ({
  requireApiAdminPermission: vi.fn().mockResolvedValue({
    error: null,
    user: { id: "user-1", orgId: "org-default", orgRole: "org_admin" },
  }),
}))

vi.mock("@/lib/db/roles", () => ({
  getRolesForOrg: vi.fn().mockResolvedValue([
    {
      id: "role-1",
      orgId: "org-default",
      name: "org_admin",
      label: "Administrator",
      isSystem: true,
      createdAt: "2024-01-01T00:00:00Z",
    },
  ]),
  createRole: vi.fn().mockResolvedValue({
    id: "role-new",
    orgId: "org-default",
    name: "analyst",
    label: "Analyst",
    isSystem: false,
    createdAt: "2024-01-01T00:00:00Z",
  }),
}))

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/admin/roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("GET /api/admin/roles", () => {
  it("returns roles array", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].name).toBe("org_admin")
  })

  it("returns 403 when permission denied", async () => {
    const { requireApiAdminPermission } = await import("@/lib/auth/access")
    vi.mocked(requireApiAdminPermission).mockResolvedValueOnce({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      user: null,
    })

    const res = await GET()
    expect(res.status).toBe(403)
  })
})

describe("POST /api/admin/roles", () => {
  it("creates a role and returns 201", async () => {
    const req = makeRequest({ name: "analyst", label: "Analyst" })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe("analyst")
  })

  it("returns 400 when name is missing", async () => {
    const req = makeRequest({ label: "Analyst" })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/name/)
  })

  it("returns 400 when label is missing", async () => {
    const req = makeRequest({ name: "analyst" })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 400 when name contains invalid characters", async () => {
    const req = makeRequest({ name: "My Role!", label: "My Role" })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/lowercase/)
  })
})

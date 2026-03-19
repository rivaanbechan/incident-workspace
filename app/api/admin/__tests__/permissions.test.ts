import { describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

import { GET } from "../permissions/route"

vi.mock("@/lib/auth/access", () => ({
  requireApiAdminPermission: vi.fn().mockResolvedValue({
    error: null,
    user: { id: "user-1", orgId: "org-default", orgRole: "org_admin" },
  }),
}))

describe("GET /api/admin/permissions", () => {
  it("returns permission registry grouped by domain", async () => {
    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body).toHaveProperty("cases")
    expect(body).toHaveProperty("board")
    expect(body).toHaveProperty("agents")
    expect(body).toHaveProperty("oracle")
    expect(body).toHaveProperty("admin")
    expect(Array.isArray(body.cases)).toBe(true)
    expect(body.cases[0]).toHaveProperty("id")
    expect(body.cases[0]).toHaveProperty("label")
  })

  it("returns 403 when permission check fails", async () => {
    const { requireApiAdminPermission } = await import("@/lib/auth/access")
    vi.mocked(requireApiAdminPermission).mockResolvedValueOnce({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      user: null,
    })

    const res = await GET()
    expect(res.status).toBe(403)
  })
})

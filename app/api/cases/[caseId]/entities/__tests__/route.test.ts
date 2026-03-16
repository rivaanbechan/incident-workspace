import { describe, expect, it, vi } from "vitest"
import { GET, POST } from "../route"
import { requireApiCasePermissionByCaseId } from "@/lib/auth/access"
import { getInvestigationById } from "@/lib/db/investigations"
import {
  listInvestigationEntitySummaries,
  upsertInvestigationEntity,
} from "@/lib/db/investigationEntities"

vi.mock("@/lib/auth/access", () => ({
  requireApiCasePermissionByCaseId: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock("@/lib/db/investigations", () => ({
  getInvestigationById: vi
    .fn()
    .mockResolvedValue({ id: "case-1", roomId: "room-1" }),
}))

vi.mock("@/lib/db/investigationEntities", () => ({
  listInvestigationEntitySummaries: vi.fn().mockResolvedValue([]),
  upsertInvestigationEntity: vi.fn().mockResolvedValue({
    id: "entity-1",
    kind: "host",
    value: "server-01",
    label: "Server 01",
  }),
}))

function makeRequest(body: unknown, method = "POST") {
  return new Request("http://localhost/api/cases/case-1/entities", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeContext(params: { caseId: string }) {
  return { params: Promise.resolve(params) }
}

describe("GET /api/cases/[caseId]/entities", () => {
  it("returns 200 with entities array", async () => {
    const req = new Request("http://localhost/api/cases/case-1/entities", {
      method: "GET",
    })
    const ctx = makeContext({ caseId: "case-1" })
    const res = await GET(req, ctx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })
})

describe("POST /api/cases/[caseId]/entities", () => {
  it("returns 400 when entity is missing", async () => {
    const req = makeRequest({})
    const ctx = makeContext({ caseId: "case-1" })
    const res = await POST(req, ctx)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it("returns 400 when kind is invalid", async () => {
    const req = makeRequest({
      entity: { kind: "invalid-kind", value: "server-01", label: "Server 01" },
    })
    const ctx = makeContext({ caseId: "case-1" })
    const res = await POST(req, ctx)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it("returns 400 when value is blank", async () => {
    const req = makeRequest({
      entity: { kind: "host", value: "   ", label: "Server 01" },
    })
    const ctx = makeContext({ caseId: "case-1" })
    const res = await POST(req, ctx)

    expect(res.status).toBe(400)
  })

  it("returns 201 for valid payload", async () => {
    const req = makeRequest({
      entity: { kind: "host", value: "server-01", label: "Server 01" },
    })
    const ctx = makeContext({ caseId: "case-1" })
    const res = await POST(req, ctx)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.kind).toBe("host")
    expect(body.value).toBe("server-01")
  })
})

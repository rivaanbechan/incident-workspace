import { describe, expect, it, vi } from "vitest"
import { PATCH, DELETE } from "../route"
import { requireApiCasePermissionByCaseId } from "@/lib/auth/access"
import { getInvestigationById } from "@/lib/db/investigations"
import {
  getInvestigationCaseRecord,
  updateInvestigationCaseRecord,
  deleteInvestigationCaseRecord,
} from "@/lib/db/caseRecords"

vi.mock("@/lib/auth/access", () => ({
  requireApiCasePermissionByCaseId: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock("@/lib/db/investigations", () => ({
  getInvestigationById: vi
    .fn()
    .mockResolvedValue({ id: "case-1", roomId: "room-1" }),
}))

vi.mock("@/lib/db/caseRecords", () => ({
  createInvestigationCaseRecord: vi
    .fn()
    .mockResolvedValue({ id: "rec-1", title: "Test" }),
  listInvestigationCaseRecords: vi.fn().mockResolvedValue([]),
  getInvestigationCaseRecord: vi
    .fn()
    .mockResolvedValue({ id: "rec-1", title: "Test" }),
  updateInvestigationCaseRecord: vi
    .fn()
    .mockResolvedValue({ id: "rec-1", title: "Updated" }),
  deleteInvestigationCaseRecord: vi.fn().mockResolvedValue(undefined),
}))

function makeRequest(body: unknown, method = "PATCH") {
  return new Request("http://localhost/api/cases/case-1/records/rec-1", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeContext(params: { caseId: string; recordId: string }) {
  return { params: Promise.resolve(params) }
}

const validRecord = {
  kind: "finding",
  title: "Updated Title",
  summary: "Updated Summary",
}

describe("PATCH /api/cases/[caseId]/records/[recordId]", () => {
  it("returns 400 when title is missing", async () => {
    const req = makeRequest({ record: { kind: "finding", summary: "Some summary" } })
    const ctx = makeContext({ caseId: "case-1", recordId: "rec-1" })
    const res = await PATCH(req, ctx)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it("returns 400 when summary is blank", async () => {
    const req = makeRequest({ record: { kind: "finding", title: "Title", summary: "  " } })
    const ctx = makeContext({ caseId: "case-1", recordId: "rec-1" })
    const res = await PATCH(req, ctx)

    expect(res.status).toBe(400)
  })

  it("returns 400 when kind is missing", async () => {
    const req = makeRequest({ record: { title: "Title", summary: "Summary" } })
    const ctx = makeContext({ caseId: "case-1", recordId: "rec-1" })
    const res = await PATCH(req, ctx)

    expect(res.status).toBe(400)
  })

  it("returns 400 when kind is invalid", async () => {
    const req = makeRequest({
      record: { ...validRecord, kind: "invalid-kind" },
    })
    const ctx = makeContext({ caseId: "case-1", recordId: "rec-1" })
    const res = await PATCH(req, ctx)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/kind/i)
  })

  it("returns 404 when record not found", async () => {
    vi.mocked(getInvestigationCaseRecord).mockResolvedValueOnce(null)

    const req = makeRequest({ record: validRecord })
    const ctx = makeContext({ caseId: "case-1", recordId: "rec-1" })
    const res = await PATCH(req, ctx)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it("returns 200 with updated record for valid payload", async () => {
    const req = makeRequest({ record: validRecord })
    const ctx = makeContext({ caseId: "case-1", recordId: "rec-1" })
    const res = await PATCH(req, ctx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe("rec-1")
    expect(body.title).toBe("Updated")
  })
})

describe("DELETE /api/cases/[caseId]/records/[recordId]", () => {
  it("returns 200 with { ok: true }", async () => {
    const req = new Request("http://localhost/api/cases/case-1/records/rec-1", {
      method: "DELETE",
    })
    const ctx = makeContext({ caseId: "case-1", recordId: "rec-1" })
    const res = await DELETE(req, ctx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})

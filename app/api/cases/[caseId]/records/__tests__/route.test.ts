import { describe, expect, it, vi } from "vitest"
import { GET, POST } from "../route"
import { requireApiCasePermissionByCaseId } from "@/lib/auth/access"
import { getInvestigationById } from "@/lib/db/investigations"
import {
  createInvestigationCaseRecord,
  listInvestigationCaseRecords,
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

function makeRequest(body: unknown, method = "POST") {
  return new Request("http://localhost/api/cases/case-1/records", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeContext(params: { caseId: string }) {
  return { params: Promise.resolve(params) }
}

const validRecord = {
  kind: "evidence",
  sourceType: "note",
  sourceId: "src-1",
  sourceModule: "mod-1",
  sourceRoomId: "room-1",
  title: "My Title",
  summary: "My Summary",
}

describe("GET /api/cases/[caseId]/records", () => {
  it("returns 200 with records array", async () => {
    const req = new Request("http://localhost/api/cases/case-1/records", {
      method: "GET",
    })
    const ctx = makeContext({ caseId: "case-1" })
    const res = await GET(req, ctx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it("returns 404 when investigation not found", async () => {
    vi.mocked(getInvestigationById).mockResolvedValueOnce(null)

    const req = new Request("http://localhost/api/cases/case-1/records", {
      method: "GET",
    })
    const ctx = makeContext({ caseId: "case-1" })
    const res = await GET(req, ctx)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})

describe("POST /api/cases/[caseId]/records", () => {
  it("returns 400 when record is missing", async () => {
    const req = makeRequest({})
    const ctx = makeContext({ caseId: "case-1" })
    const res = await POST(req, ctx)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it("returns 400 when title is blank", async () => {
    const req = makeRequest({ record: { ...validRecord, title: "   " } })
    const ctx = makeContext({ caseId: "case-1" })
    const res = await POST(req, ctx)

    expect(res.status).toBe(400)
  })

  it("returns 400 when summary is blank", async () => {
    const req = makeRequest({ record: { ...validRecord, summary: "" } })
    const ctx = makeContext({ caseId: "case-1" })
    const res = await POST(req, ctx)

    expect(res.status).toBe(400)
  })

  it("returns 400 when kind is invalid", async () => {
    const req = makeRequest({ record: { ...validRecord, kind: "unknown-kind" } })
    const ctx = makeContext({ caseId: "case-1" })
    const res = await POST(req, ctx)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/kind/i)
  })

  it("returns 400 when sourceType is invalid", async () => {
    const req = makeRequest({
      record: { ...validRecord, sourceType: "bad-source-type" },
    })
    const ctx = makeContext({ caseId: "case-1" })
    const res = await POST(req, ctx)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it("returns 400 when sourceId is missing", async () => {
    const req = makeRequest({ record: { ...validRecord, sourceId: "" } })
    const ctx = makeContext({ caseId: "case-1" })
    const res = await POST(req, ctx)

    expect(res.status).toBe(400)
  })

  it("returns 400 when sourceModule is missing", async () => {
    const req = makeRequest({ record: { ...validRecord, sourceModule: "  " } })
    const ctx = makeContext({ caseId: "case-1" })
    const res = await POST(req, ctx)

    expect(res.status).toBe(400)
  })

  it("returns 400 when sourceRoomId is missing", async () => {
    const req = makeRequest({ record: { ...validRecord, sourceRoomId: "" } })
    const ctx = makeContext({ caseId: "case-1" })
    const res = await POST(req, ctx)

    expect(res.status).toBe(400)
  })

  it("returns 201 with the created record for a valid payload", async () => {
    const req = makeRequest({ record: validRecord })
    const ctx = makeContext({ caseId: "case-1" })
    const res = await POST(req, ctx)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe("rec-1")
  })

  it("passes all required fields to createInvestigationCaseRecord", async () => {
    const req = makeRequest({ record: validRecord })
    const ctx = makeContext({ caseId: "case-1" })
    await POST(req, ctx)

    expect(createInvestigationCaseRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: validRecord.kind,
        sourceType: validRecord.sourceType,
        sourceId: validRecord.sourceId,
        sourceModule: validRecord.sourceModule,
        sourceRoomId: validRecord.sourceRoomId,
        title: validRecord.title,
        summary: validRecord.summary,
      }),
    )
  })
})

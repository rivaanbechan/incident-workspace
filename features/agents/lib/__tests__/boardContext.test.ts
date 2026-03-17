import { describe, it, expect } from "vitest"
import { serialiseBoardForScope } from "@/features/agents/lib/boardContext"
import type { BoardEntity, BoardConnection } from "@/features/incident-workspace/lib/board/types"

const noteEntity: BoardEntity = {
  body: "Suspicious traffic from this IP",
  color: "#fef08a",
  createdAt: 1700000000000,
  height: 420,
  id: "note-1",
  title: "192.168.1.100",
  type: "note",
  updatedAt: 1700000000000,
  width: 460,
  x: 100,
  y: 100,
  zIndex: 1,
}

describe("serialiseBoardForScope — focused_entity", () => {
  it("serialises the focused entity's title and body", () => {
    const result = serialiseBoardForScope("note-1", [noteEntity], [])
    expect(result).toContain("note-1")
    expect(result).toContain("192.168.1.100")
    expect(result).toContain("Suspicious traffic")
  })

  it("returns a not-found message for unknown entity", () => {
    const result = serialiseBoardForScope("missing", [noteEntity], [])
    expect(result).toContain("missing")
  })

  it("includes connection information", () => {
    const connection: BoardConnection = {
      createdAt: 1700000000000,
      id: "conn-1",
      sourceEntityId: "note-1",
      targetEntityId: "note-2",
      type: "relates_to",
      updatedAt: 1700000000000,
    }

    const target: BoardEntity = {
      ...noteEntity,
      id: "note-2",
      title: "Related evidence",
    }

    const result = serialiseBoardForScope("note-1", [noteEntity, target], [connection])
    expect(result).toContain("relates_to")
    expect(result).toContain("Related evidence")
  })

  it("caps output at ~8000 chars", () => {
    const longBody = "x".repeat(10_000)
    const fatEntity: BoardEntity = { ...noteEntity, body: longBody }
    const result = serialiseBoardForScope("note-1", [fatEntity], [])
    expect(result.length).toBeLessThanOrEqual(8_100)
  })
})

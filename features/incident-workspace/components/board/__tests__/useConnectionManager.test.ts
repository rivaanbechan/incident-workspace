import { describe, it, expect, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import * as Y from "yjs"
import { useConnectionManager } from "@/features/incident-workspace/components/board/useConnectionManager"
import { parseBoardConnection } from "@/features/incident-workspace/components/board/boardCore"

function makeArgs() {
  const doc = new Y.Doc()
  const connectionsRef = { current: doc.getArray<string>("connections") }
  return { connectionsRef }
}

describe("useConnectionManager", () => {
  describe("createConnection", () => {
    it("pushes a new connection to connectionsRef", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useConnectionManager(args))

      act(() => {
        result.current.createConnection("entity-a", "entity-b", "relates_to")
      })

      const items = args.connectionsRef.current.toArray().map(parseBoardConnection).filter(Boolean)
      expect(items).toHaveLength(1)
      expect(items[0]?.sourceEntityId).toBe("entity-a")
      expect(items[0]?.targetEntityId).toBe("entity-b")
      expect(items[0]?.type).toBe("relates_to")
    })

    it("assigns a non-empty id prefixed with 'connection'", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useConnectionManager(args))

      act(() => {
        result.current.createConnection("entity-a", "entity-b", "blocks")
      })

      const items = args.connectionsRef.current.toArray().map(parseBoardConnection).filter(Boolean)
      expect(items[0]?.id).toMatch(/^connection-/)
    })

    it("is a no-op when source === target", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useConnectionManager(args))

      act(() => {
        result.current.createConnection("entity-a", "entity-a", "relates_to")
      })

      expect(args.connectionsRef.current.length).toBe(0)
    })

    it("is a no-op for duplicate connections with the same source, target, and type", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useConnectionManager(args))

      act(() => {
        result.current.createConnection("entity-a", "entity-b", "supports")
        result.current.createConnection("entity-a", "entity-b", "supports")
      })

      expect(args.connectionsRef.current.length).toBe(1)
    })

    it("allows two connections with different types between the same entities", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useConnectionManager(args))

      act(() => {
        result.current.createConnection("entity-a", "entity-b", "supports")
        result.current.createConnection("entity-a", "entity-b", "blocks")
      })

      expect(args.connectionsRef.current.length).toBe(2)
    })

    it("is a no-op for duplicate custom connections with the same label", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useConnectionManager(args))

      act(() => {
        result.current.createConnection("entity-a", "entity-b", "custom", "My label")
        result.current.createConnection("entity-a", "entity-b", "custom", "My label")
      })

      expect(args.connectionsRef.current.length).toBe(1)
    })
  })

  describe("deleteConnection", () => {
    it("removes the connection by ID from connectionsRef", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useConnectionManager(args))

      act(() => {
        result.current.createConnection("entity-a", "entity-b", "supports")
      })

      const items = args.connectionsRef.current.toArray().map(parseBoardConnection).filter(Boolean)
      const connectionId = items[0]!.id

      act(() => {
        result.current.deleteConnection(connectionId)
      })

      expect(args.connectionsRef.current.length).toBe(0)
    })

    it("is a no-op when the connection ID does not exist", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useConnectionManager(args))

      act(() => {
        result.current.createConnection("entity-a", "entity-b", "supports")
      })

      act(() => {
        result.current.deleteConnection("non-existent-id")
      })

      expect(args.connectionsRef.current.length).toBe(1)
    })

    it("only removes the targeted connection when multiple exist", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useConnectionManager(args))

      act(() => {
        result.current.createConnection("entity-a", "entity-b", "supports")
        result.current.createConnection("entity-b", "entity-c", "blocks")
      })

      const items = args.connectionsRef.current.toArray().map(parseBoardConnection).filter(Boolean)
      const firstId = items[0]!.id

      act(() => {
        result.current.deleteConnection(firstId)
      })

      const remaining = args.connectionsRef.current.toArray().map(parseBoardConnection).filter(Boolean)
      expect(remaining).toHaveLength(1)
      expect(remaining[0]?.sourceEntityId).toBe("entity-b")
    })
  })

  describe("updateConnection", () => {
    it("updates the connection in place at the same index", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useConnectionManager(args))

      act(() => {
        result.current.createConnection("entity-a", "entity-b", "supports")
        result.current.createConnection("entity-b", "entity-c", "blocks")
      })

      const itemsBefore = args.connectionsRef.current.toArray().map(parseBoardConnection).filter(Boolean)
      const targetId = itemsBefore[0]!.id

      act(() => {
        result.current.updateConnection(targetId, (conn) => ({
          ...conn,
          type: "mitigates",
        }))
      })

      const itemsAfter = args.connectionsRef.current.toArray().map(parseBoardConnection).filter(Boolean)
      expect(itemsAfter).toHaveLength(2)
      expect(itemsAfter[0]?.id).toBe(targetId)
      expect(itemsAfter[0]?.type).toBe("mitigates")
      // Second connection is unchanged
      expect(itemsAfter[1]?.type).toBe("blocks")
    })

    it("passes a copy with updatedAt bumped to the updater", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useConnectionManager(args))

      act(() => {
        result.current.createConnection("entity-a", "entity-b", "relates_to")
      })

      const itemsBefore = args.connectionsRef.current.toArray().map(parseBoardConnection).filter(Boolean)
      const originalUpdatedAt = itemsBefore[0]!.updatedAt
      const connectionId = itemsBefore[0]!.id

      let receivedUpdatedAt: number | undefined

      act(() => {
        result.current.updateConnection(connectionId, (conn) => {
          receivedUpdatedAt = conn.updatedAt
          return conn
        })
      })

      expect(receivedUpdatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })

    it("is a no-op when the connection ID does not exist", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useConnectionManager(args))

      act(() => {
        result.current.createConnection("entity-a", "entity-b", "supports")
      })

      act(() => {
        result.current.updateConnection("non-existent-id", (conn) => ({ ...conn, type: "blocks" }))
      })

      const items = args.connectionsRef.current.toArray().map(parseBoardConnection).filter(Boolean)
      expect(items[0]?.type).toBe("supports")
    })
  })
})

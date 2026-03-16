import { describe, it, expect } from "vitest"
import { renderHook, act } from "@testing-library/react"
import * as Y from "yjs"
import { useEntityManager } from "@/features/incident-workspace/components/board/useEntityManager"
import {
  createNote,
  parseEntity,
  serializeEntity,
  serializeBoardConnection,
  createBoardConnection,
} from "@/features/incident-workspace/components/board/boardCore"

function makeStageRef() {
  const stageElement = document.createElement("div")
  Object.defineProperty(stageElement, "getBoundingClientRect", {
    value: () => ({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 800,
      width: 1000,
      height: 800,
    }),
  })
  return { current: stageElement }
}

function makeArgs() {
  const doc = new Y.Doc()
  const entityMapRef = { current: doc.getMap<string>("entities") }
  const connectionsRef = { current: doc.getArray<string>("connections") }
  const cameraRef = { current: { x: 0, y: 0, zoom: 1 } }
  const stageRef = makeStageRef()
  return { entityMapRef, connectionsRef, cameraRef, stageRef, isSynced: true }
}

describe("useEntityManager", () => {
  describe("createEntityAtViewportCenter", () => {
    it("calls the factory and serializes the entity into entityMapRef", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useEntityManager(args))

      act(() => {
        result.current.createEntityAtViewportCenter(createNote)
      })

      expect(args.entityMapRef.current.size).toBe(1)
      const rawValues = Array.from(args.entityMapRef.current.values())
      const entity = parseEntity(rawValues[0])
      expect(entity).not.toBeNull()
      expect(entity?.type).toBe("note")
    })

    it("sets selectedEntityId to the new entity's id", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useEntityManager(args))

      act(() => {
        result.current.createEntityAtViewportCenter(createNote)
      })

      const rawValues = Array.from(args.entityMapRef.current.values())
      const entity = parseEntity(rawValues[0])
      expect(result.current.selectedEntityId).toBe(entity?.id)
    })

    it("centers the entity on the viewport (x adjusted by width/2, y adjusted by height/2)", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useEntityManager(args))

      act(() => {
        result.current.createEntityAtViewportCenter(createNote)
      })

      const rawValues = Array.from(args.entityMapRef.current.values())
      const entity = parseEntity(rawValues[0])
      expect(entity).not.toBeNull()

      // With camera {x:0, y:0, zoom:1} and rect {left:0, top:0, width:1000, height:800}
      // screenToBoard(500, 400, rect, camera) = { x: 500, y: 400 }
      // entity is then centered: x = 500 - width/2, y = 400 - height/2
      expect(entity?.x).toBe(500 - entity!.width / 2)
      expect(entity?.y).toBe(400 - entity!.height / 2)
    })

    it("returns the new entity's id", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useEntityManager(args))

      let returnedId: string | null = null

      act(() => {
        returnedId = result.current.createEntityAtViewportCenter(createNote)
      })

      const rawValues = Array.from(args.entityMapRef.current.values())
      const entity = parseEntity(rawValues[0])
      expect(returnedId).toBe(entity?.id)
    })
  })

  describe("updateEntity", () => {
    it("applies the updater function to the existing entity", () => {
      const args = makeArgs()
      const note = createNote({ x: 100, y: 100 }, 1)
      args.entityMapRef.current.set(note.id, serializeEntity(note))

      const { result } = renderHook(() => useEntityManager(args))

      act(() => {
        result.current.updateEntity(note.id, (entity) => ({
          ...entity,
          title: "Updated title",
        }))
      })

      const updated = parseEntity(args.entityMapRef.current.get(note.id))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((updated as any)?.title).toBe("Updated title")
      expect(updated?.id).toBe(note.id)
    })

    it("does not change the number of entities in entityMapRef", () => {
      const args = makeArgs()
      const note = createNote({ x: 100, y: 100 }, 1)
      args.entityMapRef.current.set(note.id, serializeEntity(note))

      const { result } = renderHook(() => useEntityManager(args))

      act(() => {
        result.current.updateEntity(note.id, (entity) => ({
          ...entity,
          body: "new body",
        }))
      })

      expect(args.entityMapRef.current.size).toBe(1)
    })

    it("is a no-op when the entity ID does not exist", () => {
      const args = makeArgs()
      const note = createNote({ x: 100, y: 100 }, 1)
      args.entityMapRef.current.set(note.id, serializeEntity(note))

      const { result } = renderHook(() => useEntityManager(args))

      act(() => {
        result.current.updateEntity("non-existent-id", (entity) => ({
          ...entity,
          title: "Should not appear",
        }))
      })

      const existing = parseEntity(args.entityMapRef.current.get(note.id))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((existing as any)?.title).toBe(note.title)
    })
  })

  describe("deleteEntity", () => {
    it("removes the entity from entityMapRef", () => {
      const args = makeArgs()
      const note = createNote({ x: 100, y: 100 }, 1)
      args.entityMapRef.current.set(note.id, serializeEntity(note))

      const { result } = renderHook(() => useEntityManager(args))

      act(() => {
        result.current.deleteEntity(note.id)
      })

      expect(args.entityMapRef.current.size).toBe(0)
    })

    it("removes connections where the deleted entity is the source", () => {
      const args = makeArgs()
      const note = createNote({ x: 100, y: 100 }, 1)
      const other = createNote({ x: 200, y: 200 }, 2)
      args.entityMapRef.current.set(note.id, serializeEntity(note))
      args.entityMapRef.current.set(other.id, serializeEntity(other))

      const connection = createBoardConnection(note.id, other.id, "relates_to")
      args.connectionsRef.current.push([serializeBoardConnection(connection)])

      const { result } = renderHook(() => useEntityManager(args))

      act(() => {
        result.current.deleteEntity(note.id)
      })

      expect(args.connectionsRef.current.length).toBe(0)
    })

    it("removes connections where the deleted entity is the target", () => {
      const args = makeArgs()
      const note = createNote({ x: 100, y: 100 }, 1)
      const other = createNote({ x: 200, y: 200 }, 2)
      args.entityMapRef.current.set(note.id, serializeEntity(note))
      args.entityMapRef.current.set(other.id, serializeEntity(other))

      const connection = createBoardConnection(other.id, note.id, "blocks")
      args.connectionsRef.current.push([serializeBoardConnection(connection)])

      const { result } = renderHook(() => useEntityManager(args))

      act(() => {
        result.current.deleteEntity(note.id)
      })

      expect(args.connectionsRef.current.length).toBe(0)
    })

    it("only removes connections that reference the deleted entity", () => {
      const args = makeArgs()
      const noteA = createNote({ x: 100, y: 100 }, 1)
      const noteB = createNote({ x: 200, y: 200 }, 2)
      const noteC = createNote({ x: 300, y: 300 }, 3)
      args.entityMapRef.current.set(noteA.id, serializeEntity(noteA))
      args.entityMapRef.current.set(noteB.id, serializeEntity(noteB))
      args.entityMapRef.current.set(noteC.id, serializeEntity(noteC))

      const connectionToDelete = createBoardConnection(noteA.id, noteB.id, "relates_to")
      const connectionToKeep = createBoardConnection(noteB.id, noteC.id, "supports")
      args.connectionsRef.current.push([
        serializeBoardConnection(connectionToDelete),
        serializeBoardConnection(connectionToKeep),
      ])

      const { result } = renderHook(() => useEntityManager(args))

      act(() => {
        result.current.deleteEntity(noteA.id)
      })

      expect(args.connectionsRef.current.length).toBe(1)
    })
  })

  describe("setEntities", () => {
    it("updates the entities state when called via act", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useEntityManager(args))

      const note = createNote({ x: 100, y: 200 }, 1)

      act(() => {
        result.current.setEntities([note])
      })

      expect(result.current.entities).toHaveLength(1)
      expect(result.current.entities[0]?.id).toBe(note.id)
    })

    it("replaces the entities state with the new array", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useEntityManager(args))

      const noteA = createNote({ x: 100, y: 100 }, 1)
      const noteB = createNote({ x: 200, y: 200 }, 2)

      act(() => {
        result.current.setEntities([noteA])
      })

      act(() => {
        result.current.setEntities([noteA, noteB])
      })

      expect(result.current.entities).toHaveLength(2)
    })
  })
})

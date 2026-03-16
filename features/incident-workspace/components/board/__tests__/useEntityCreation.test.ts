import { describe, it, expect, vi } from "vitest"
import { useEntityCreation } from "@/features/incident-workspace/components/board/useEntityCreation"
import type { BoardEntity, BoardPoint } from "@/features/incident-workspace/lib/board/types"

function makeArgs() {
  const createEntityAtViewportCenter = vi.fn(
    (factory: (point: BoardPoint, zIndex: number) => BoardEntity) => {
      const entity = factory({ x: 100, y: 100 }, 1)
      return entity.id
    },
  )

  const setPendingMapPrompt = vi.fn()

  const args = {
    createEntityAtViewportCenter,
    entities: [] as BoardEntity[],
    setPendingMapPrompt,
  }

  return { args, createEntityAtViewportCenter, setPendingMapPrompt }
}

describe("useEntityCreation", () => {
  describe("handleCreateNote", () => {
    it("calls createEntityAtViewportCenter with a hypothesis note factory", () => {
      const { args, createEntityAtViewportCenter } = makeArgs()
      const { handleCreateNote } = useEntityCreation(args)

      handleCreateNote()

      expect(createEntityAtViewportCenter).toHaveBeenCalledOnce()
      const factory = createEntityAtViewportCenter.mock.calls[0]![0]
      const entity = factory({ x: 0, y: 0 }, 1)

      expect(entity.type).toBe("note")
      expect((entity as { mapKind?: string }).mapKind).toBe("hypothesis")
    })

    it("sets pendingMapPrompt to null on success", () => {
      const { args, setPendingMapPrompt } = makeArgs()
      const { handleCreateNote } = useEntityCreation(args)

      handleCreateNote()

      expect(setPendingMapPrompt).toHaveBeenCalledWith(null)
    })
  })

  describe("handleCreateIncidentCard", () => {
    it("calls createEntityAtViewportCenter with a scope incident card factory", () => {
      const { args, createEntityAtViewportCenter } = makeArgs()
      const { handleCreateIncidentCard } = useEntityCreation(args)

      handleCreateIncidentCard()

      const factory = createEntityAtViewportCenter.mock.calls[0]![0]
      const entity = factory({ x: 0, y: 0 }, 1)

      expect(entity.type).toBe("incidentCard")
      expect((entity as { mapKind?: string }).mapKind).toBe("scope")
    })

    it("sets pendingMapPrompt with recommendedAction 'feed'", () => {
      const { args, setPendingMapPrompt } = makeArgs()
      const { handleCreateIncidentCard } = useEntityCreation(args)

      handleCreateIncidentCard()

      expect(setPendingMapPrompt).toHaveBeenCalledWith(
        expect.objectContaining({ recommendedAction: "feed" }),
      )
    })
  })

  describe("handleCreateEvidenceNote", () => {
    it("creates a note with mapKind 'evidence'", () => {
      const { args, createEntityAtViewportCenter } = makeArgs()
      const { handleCreateEvidenceNote } = useEntityCreation(args)

      handleCreateEvidenceNote()

      const factory = createEntityAtViewportCenter.mock.calls[0]![0]
      const entity = factory({ x: 0, y: 0 }, 1)

      expect(entity.type).toBe("note")
      expect((entity as { mapKind?: string }).mapKind).toBe("evidence")
    })

    it("sets pendingMapPrompt with recommendedAction 'feed'", () => {
      const { args, setPendingMapPrompt } = makeArgs()
      const { handleCreateEvidenceNote } = useEntityCreation(args)

      handleCreateEvidenceNote()

      expect(setPendingMapPrompt).toHaveBeenCalledWith(
        expect.objectContaining({ recommendedAction: "feed" }),
      )
    })
  })

  describe("handleCreateBlocker", () => {
    it("creates a note with mapKind 'blocker'", () => {
      const { args, createEntityAtViewportCenter } = makeArgs()
      const { handleCreateBlocker } = useEntityCreation(args)

      handleCreateBlocker()

      const factory = createEntityAtViewportCenter.mock.calls[0]![0]
      const entity = factory({ x: 0, y: 0 }, 1)

      expect(entity.type).toBe("note")
      expect((entity as { mapKind?: string }).mapKind).toBe("blocker")
    })

    it("sets pendingMapPrompt with recommendedAction 'action'", () => {
      const { args, setPendingMapPrompt } = makeArgs()
      const { handleCreateBlocker } = useEntityCreation(args)

      handleCreateBlocker()

      expect(setPendingMapPrompt).toHaveBeenCalledWith(
        expect.objectContaining({ recommendedAction: "action" }),
      )
    })
  })

  describe("handleCreateHandoff", () => {
    it("creates a note with mapKind 'handoff'", () => {
      const { args, createEntityAtViewportCenter } = makeArgs()
      const { handleCreateHandoff } = useEntityCreation(args)

      handleCreateHandoff()

      const factory = createEntityAtViewportCenter.mock.calls[0]![0]
      const entity = factory({ x: 0, y: 0 }, 1)

      expect(entity.type).toBe("note")
      expect((entity as { mapKind?: string }).mapKind).toBe("handoff")
    })
  })

  describe("handleCreateZone", () => {
    it("creates an investigationZone entity", () => {
      const { args, createEntityAtViewportCenter } = makeArgs()
      const { handleCreateZone } = useEntityCreation(args)

      handleCreateZone()

      const factory = createEntityAtViewportCenter.mock.calls[0]![0]
      const entity = factory({ x: 0, y: 0 }, 1)

      expect(entity.type).toBe("investigationZone")
    })

    it("sets pendingMapPrompt to null", () => {
      const { args, setPendingMapPrompt } = makeArgs()
      const { handleCreateZone } = useEntityCreation(args)

      handleCreateZone()

      expect(setPendingMapPrompt).toHaveBeenCalledWith(null)
    })
  })

  describe("handleCreateHypothesis", () => {
    it("creates a note with mapKind 'hypothesis' and title 'Hypothesis'", () => {
      const { args, createEntityAtViewportCenter } = makeArgs()
      const { handleCreateHypothesis } = useEntityCreation(args)

      handleCreateHypothesis()

      const factory = createEntityAtViewportCenter.mock.calls[0]![0]
      const entity = factory({ x: 0, y: 0 }, 1)

      expect(entity.type).toBe("note")
      expect((entity as { mapKind?: string; title: string }).title).toBe("Hypothesis")
    })
  })
})

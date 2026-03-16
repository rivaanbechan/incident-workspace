import { describe, it, expect } from "vitest"
import { renderHook, act } from "@testing-library/react"
import * as Y from "yjs"
import { useTimelineManager } from "@/features/incident-workspace/components/board/useTimelineManager"
import {
  parseIncidentActionItem,
  parseIncidentLogEntry,
  serializeIncidentActionItem,
  serializeIncidentLogEntry,
  createIncidentActionItem,
  createTypedIncidentLogEntry,
} from "@/features/incident-workspace/components/board/boardCore"
import type { PresenceUser } from "@/features/incident-workspace/lib/board/types"

const TEST_USER: PresenceUser = { id: "user-1", name: "Test User", color: "#ff0000" }

function makeArgs(overrides?: { selectedEntityId?: string | null }) {
  const doc = new Y.Doc()
  const incidentActionsRef = { current: doc.getArray<string>("actions") }
  const incidentLogRef = { current: doc.getArray<string>("log") }
  return {
    incidentActionsRef,
    incidentLogRef,
    selectedEntityId: overrides?.selectedEntityId ?? null,
    user: TEST_USER,
  }
}

describe("useTimelineManager", () => {
  describe("addPreparedIncidentLogEntry", () => {
    it("pushes an entry to incidentLogRef", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useTimelineManager(args))

      act(() => {
        result.current.addPreparedIncidentLogEntry({
          body: "Mitigation applied",
          type: "update",
        })
      })

      const items = args.incidentLogRef.current.toArray().map(parseIncidentLogEntry).filter(Boolean)
      expect(items).toHaveLength(1)
      expect(items[0]?.body).toBe("Mitigation applied")
    })

    it("uses the provided user as author", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useTimelineManager(args))

      act(() => {
        result.current.addPreparedIncidentLogEntry({
          body: "Rolled back deploy",
          type: "update",
        })
      })

      const items = args.incidentLogRef.current.toArray().map(parseIncidentLogEntry).filter(Boolean)
      expect(items[0]?.authorId).toBe(TEST_USER.id)
      expect(items[0]?.authorName).toBe(TEST_USER.name)
    })

    it("stores the given entry type", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useTimelineManager(args))

      act(() => {
        result.current.addPreparedIncidentLogEntry({
          body: "Decided to roll back",
          type: "decision",
        })
      })

      const items = args.incidentLogRef.current.toArray().map(parseIncidentLogEntry).filter(Boolean)
      expect(items[0]?.type).toBe("decision")
    })

    it("stores linkedEntityIds when provided", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useTimelineManager(args))

      act(() => {
        result.current.addPreparedIncidentLogEntry({
          body: "Note linked to entity",
          linkedEntityIds: ["entity-xyz"],
          type: "update",
        })
      })

      const items = args.incidentLogRef.current.toArray().map(parseIncidentLogEntry).filter(Boolean)
      expect(items[0]?.linkedEntityIds).toContain("entity-xyz")
    })

    it("is a no-op for empty body", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useTimelineManager(args))

      act(() => {
        result.current.addPreparedIncidentLogEntry({ body: "   ", type: "update" })
      })

      expect(args.incidentLogRef.current.length).toBe(0)
    })

    it("is a no-op for completely empty body string", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useTimelineManager(args))

      act(() => {
        result.current.addPreparedIncidentLogEntry({ body: "", type: "update" })
      })

      expect(args.incidentLogRef.current.length).toBe(0)
    })
  })

  describe("deleteIncidentLogEntry", () => {
    it("removes the entry from incidentLogRef", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useTimelineManager(args))

      act(() => {
        result.current.addPreparedIncidentLogEntry({ body: "First entry", type: "update" })
      })

      const items = args.incidentLogRef.current.toArray().map(parseIncidentLogEntry).filter(Boolean)
      const entryId = items[0]!.id

      act(() => {
        result.current.deleteIncidentLogEntry(entryId)
      })

      expect(args.incidentLogRef.current.length).toBe(0)
    })

    it("only removes the targeted entry when multiple exist", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useTimelineManager(args))

      act(() => {
        result.current.addPreparedIncidentLogEntry({ body: "Entry one", type: "update" })
        result.current.addPreparedIncidentLogEntry({ body: "Entry two", type: "update" })
      })

      const items = args.incidentLogRef.current.toArray().map(parseIncidentLogEntry).filter(Boolean)
      const firstId = items[0]!.id

      act(() => {
        result.current.deleteIncidentLogEntry(firstId)
      })

      const remaining = args.incidentLogRef.current.toArray().map(parseIncidentLogEntry).filter(Boolean)
      expect(remaining).toHaveLength(1)
      expect(remaining[0]?.body).toBe("Entry two")
    })

    it("nulls out sourceLogEntryId on actions linked to the deleted entry", () => {
      const args = makeArgs()

      // Seed an action with sourceLogEntryId pointing to a log entry
      const logEntry = createTypedIncidentLogEntry(TEST_USER, {
        body: "Origin log entry",
        type: "update",
      })
      const action = createIncidentActionItem("Follow up task", {
        sourceLogEntryId: logEntry.id,
      })

      args.incidentLogRef.current.push([serializeIncidentLogEntry(logEntry)])
      args.incidentActionsRef.current.push([serializeIncidentActionItem(action)])

      const { result } = renderHook(() => useTimelineManager(args))

      act(() => {
        result.current.deleteIncidentLogEntry(logEntry.id)
      })

      // Log entry should be gone
      expect(args.incidentLogRef.current.length).toBe(0)

      // Action should still exist but sourceLogEntryId should be null
      const actions = args.incidentActionsRef.current.toArray().map(parseIncidentActionItem).filter(Boolean)
      expect(actions).toHaveLength(1)
      expect(actions[0]?.sourceLogEntryId).toBeNull()
    })

    it("does not delete actions that are not linked to the deleted log entry", () => {
      const args = makeArgs()

      const logEntry = createTypedIncidentLogEntry(TEST_USER, {
        body: "Log entry to delete",
        type: "update",
      })
      const unrelatedAction = createIncidentActionItem("Unrelated action", {
        sourceLogEntryId: null,
      })

      args.incidentLogRef.current.push([serializeIncidentLogEntry(logEntry)])
      args.incidentActionsRef.current.push([serializeIncidentActionItem(unrelatedAction)])

      const { result } = renderHook(() => useTimelineManager(args))

      act(() => {
        result.current.deleteIncidentLogEntry(logEntry.id)
      })

      const actions = args.incidentActionsRef.current.toArray().map(parseIncidentActionItem).filter(Boolean)
      expect(actions).toHaveLength(1)
      expect(actions[0]?.id).toBe(unrelatedAction.id)
    })
  })

  describe("createActionFromTimelineEntry", () => {
    it("pushes a new action to incidentActionsRef", () => {
      const args = makeArgs()

      const logEntry = createTypedIncidentLogEntry(TEST_USER, {
        body: "Investigate the cache layer",
        type: "update",
      })
      args.incidentLogRef.current.push([serializeIncidentLogEntry(logEntry)])

      const { result } = renderHook(() => useTimelineManager(args))

      act(() => {
        result.current.createActionFromTimelineEntry(logEntry.id)
      })

      const actions = args.incidentActionsRef.current.toArray().map(parseIncidentActionItem).filter(Boolean)
      expect(actions).toHaveLength(1)
      expect(actions[0]?.title).toBe("Investigate the cache layer")
    })

    it("uses the first line of the body as the action title", () => {
      const args = makeArgs()

      const logEntry = createTypedIncidentLogEntry(TEST_USER, {
        body: "First line title\nAdditional detail here",
        type: "update",
      })
      args.incidentLogRef.current.push([serializeIncidentLogEntry(logEntry)])

      const { result } = renderHook(() => useTimelineManager(args))

      act(() => {
        result.current.createActionFromTimelineEntry(logEntry.id)
      })

      const actions = args.incidentActionsRef.current.toArray().map(parseIncidentActionItem).filter(Boolean)
      expect(actions[0]?.title).toBe("First line title")
    })

    it("sets sourceLogEntryId on the new action to point to the log entry", () => {
      const args = makeArgs()

      const logEntry = createTypedIncidentLogEntry(TEST_USER, {
        body: "Root cause identified",
        type: "update",
      })
      args.incidentLogRef.current.push([serializeIncidentLogEntry(logEntry)])

      const { result } = renderHook(() => useTimelineManager(args))

      act(() => {
        result.current.createActionFromTimelineEntry(logEntry.id)
      })

      const actions = args.incidentActionsRef.current.toArray().map(parseIncidentActionItem).filter(Boolean)
      expect(actions[0]?.sourceLogEntryId).toBe(logEntry.id)
    })

    it("links the new action id in the log entry's linkedActionIds", () => {
      const args = makeArgs()

      const logEntry = createTypedIncidentLogEntry(TEST_USER, {
        body: "Scale up the service",
        type: "update",
      })
      args.incidentLogRef.current.push([serializeIncidentLogEntry(logEntry)])

      const { result } = renderHook(() => useTimelineManager(args))

      act(() => {
        result.current.createActionFromTimelineEntry(logEntry.id)
      })

      const actions = args.incidentActionsRef.current.toArray().map(parseIncidentActionItem).filter(Boolean)
      const actionId = actions[0]!.id

      const logEntries = args.incidentLogRef.current.toArray().map(parseIncidentLogEntry).filter(Boolean)
      expect(logEntries[0]?.linkedActionIds).toContain(actionId)
    })

    it("is a no-op when the entry ID does not exist", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useTimelineManager(args))

      act(() => {
        result.current.createActionFromTimelineEntry("non-existent-id")
      })

      expect(args.incidentActionsRef.current.length).toBe(0)
    })
  })
})

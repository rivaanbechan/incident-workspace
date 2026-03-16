import { describe, it, expect } from "vitest"
import { renderHook, act } from "@testing-library/react"
import * as Y from "yjs"
import { useActionManager } from "@/features/incident-workspace/components/board/useActionManager"
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

function makeArgs() {
  const doc = new Y.Doc()
  const incidentActionsRef = { current: doc.getArray<string>("actions") }
  const incidentLogRef = { current: doc.getArray<string>("log") }
  return { incidentActionsRef, incidentLogRef, user: TEST_USER }
}

describe("useActionManager", () => {
  describe("createActionItem", () => {
    it("pushes a new action with the given title to incidentActionsRef", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.createActionItem("Fix the memory leak")
      })

      const actions = args.incidentActionsRef.current.toArray().map(parseIncidentActionItem).filter(Boolean)
      expect(actions).toHaveLength(1)
      expect(actions[0]?.title).toBe("Fix the memory leak")
    })

    it("assigns a non-empty id prefixed with 'action'", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.createActionItem("Notify stakeholders")
      })

      const actions = args.incidentActionsRef.current.toArray().map(parseIncidentActionItem).filter(Boolean)
      expect(actions[0]?.id).toMatch(/^action-/)
    })

    it("creates the action with status 'open' by default", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.createActionItem("Page on-call engineer")
      })

      const actions = args.incidentActionsRef.current.toArray().map(parseIncidentActionItem).filter(Boolean)
      expect(actions[0]?.status).toBe("open")
    })

    it("is a no-op for empty title", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.createActionItem("")
      })

      expect(args.incidentActionsRef.current.length).toBe(0)
    })

    it("is a no-op for whitespace-only title", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.createActionItem("   ")
      })

      expect(args.incidentActionsRef.current.length).toBe(0)
    })

    it("stores linkedEntityIds when provided via options", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.createActionItem("Investigate database", {
          linkedEntityIds: ["entity-db"],
        })
      })

      const actions = args.incidentActionsRef.current.toArray().map(parseIncidentActionItem).filter(Boolean)
      expect(actions[0]?.linkedEntityIds).toContain("entity-db")
    })
  })

  describe("updateActionItem", () => {
    it("calls the updater with the existing action and writes the result back", () => {
      const args = makeArgs()

      const existingAction = createIncidentActionItem("Original title")
      args.incidentActionsRef.current.push([serializeIncidentActionItem(existingAction)])

      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.updateActionItem(existingAction.id, (action) => ({
          ...action,
          title: "Updated title",
        }))
      })

      const actions = args.incidentActionsRef.current.toArray().map(parseIncidentActionItem).filter(Boolean)
      expect(actions).toHaveLength(1)
      expect(actions[0]?.id).toBe(existingAction.id)
      expect(actions[0]?.title).toBe("Updated title")
    })

    it("writes the update back at the same index", () => {
      const args = makeArgs()

      const firstAction = createIncidentActionItem("First action")
      const secondAction = createIncidentActionItem("Second action")
      args.incidentActionsRef.current.push([
        serializeIncidentActionItem(firstAction),
        serializeIncidentActionItem(secondAction),
      ])

      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.updateActionItem(firstAction.id, (action) => ({
          ...action,
          status: "in_progress",
        }))
      })

      const actions = args.incidentActionsRef.current.toArray().map(parseIncidentActionItem).filter(Boolean)
      expect(actions).toHaveLength(2)
      expect(actions[0]?.id).toBe(firstAction.id)
      expect(actions[0]?.status).toBe("in_progress")
      expect(actions[1]?.id).toBe(secondAction.id)
    })

    it("passes a copy with updatedAt bumped to the updater", () => {
      const args = makeArgs()

      const existingAction = createIncidentActionItem("Some action")
      args.incidentActionsRef.current.push([serializeIncidentActionItem(existingAction)])

      const { result } = renderHook(() => useActionManager(args))

      let receivedUpdatedAt: number | undefined

      act(() => {
        result.current.updateActionItem(existingAction.id, (action) => {
          receivedUpdatedAt = action.updatedAt
          return action
        })
      })

      expect(receivedUpdatedAt).toBeGreaterThanOrEqual(existingAction.updatedAt)
    })

    it("is a no-op when the action ID does not exist", () => {
      const args = makeArgs()

      const existingAction = createIncidentActionItem("Unchanged action")
      args.incidentActionsRef.current.push([serializeIncidentActionItem(existingAction)])

      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.updateActionItem("non-existent-id", (action) => ({
          ...action,
          status: "done",
        }))
      })

      const actions = args.incidentActionsRef.current.toArray().map(parseIncidentActionItem).filter(Boolean)
      expect(actions[0]?.status).toBe("open")
    })
  })

  describe("deleteActionItem", () => {
    it("removes the action from incidentActionsRef", () => {
      const args = makeArgs()

      const action = createIncidentActionItem("Action to delete")
      args.incidentActionsRef.current.push([serializeIncidentActionItem(action)])

      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.deleteActionItem(action.id)
      })

      expect(args.incidentActionsRef.current.length).toBe(0)
    })

    it("only removes the targeted action when multiple exist", () => {
      const args = makeArgs()

      const first = createIncidentActionItem("First action")
      const second = createIncidentActionItem("Second action")
      args.incidentActionsRef.current.push([
        serializeIncidentActionItem(first),
        serializeIncidentActionItem(second),
      ])

      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.deleteActionItem(first.id)
      })

      const remaining = args.incidentActionsRef.current.toArray().map(parseIncidentActionItem).filter(Boolean)
      expect(remaining).toHaveLength(1)
      expect(remaining[0]?.id).toBe(second.id)
    })

    it("removes the actionId from linkedActionIds of log entries that reference it", () => {
      const args = makeArgs()

      const action = createIncidentActionItem("Action to delete")
      const logEntry = createTypedIncidentLogEntry(TEST_USER, {
        body: "Entry linked to action",
        linkedActionIds: [action.id],
        type: "update",
      })

      args.incidentActionsRef.current.push([serializeIncidentActionItem(action)])
      args.incidentLogRef.current.push([serializeIncidentLogEntry(logEntry)])

      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.deleteActionItem(action.id)
      })

      // Log entry should still exist
      const entries = args.incidentLogRef.current.toArray().map(parseIncidentLogEntry).filter(Boolean)
      expect(entries).toHaveLength(1)
      expect(entries[0]?.id).toBe(logEntry.id)
      // But the actionId should be removed from linkedActionIds
      expect(entries[0]?.linkedActionIds).not.toContain(action.id)
    })

    it("does not delete log entries when removing the actionId from their linkedActionIds", () => {
      const args = makeArgs()

      const action = createIncidentActionItem("Action to remove")
      const logEntry = createTypedIncidentLogEntry(TEST_USER, {
        body: "Entry that survives deletion",
        linkedActionIds: [action.id],
        type: "update",
      })

      args.incidentActionsRef.current.push([serializeIncidentActionItem(action)])
      args.incidentLogRef.current.push([serializeIncidentLogEntry(logEntry)])

      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.deleteActionItem(action.id)
      })

      const entries = args.incidentLogRef.current.toArray().map(parseIncidentLogEntry).filter(Boolean)
      expect(entries).toHaveLength(1)
    })

    it("does not modify log entries that do not reference the deleted action", () => {
      const args = makeArgs()

      const action = createIncidentActionItem("Action to delete")
      const otherAction = createIncidentActionItem("Other action")
      const logEntry = createTypedIncidentLogEntry(TEST_USER, {
        body: "Entry linked to other action",
        linkedActionIds: [otherAction.id],
        type: "update",
      })

      args.incidentActionsRef.current.push([
        serializeIncidentActionItem(action),
        serializeIncidentActionItem(otherAction),
      ])
      args.incidentLogRef.current.push([serializeIncidentLogEntry(logEntry)])

      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.deleteActionItem(action.id)
      })

      const entries = args.incidentLogRef.current.toArray().map(parseIncidentLogEntry).filter(Boolean)
      expect(entries[0]?.linkedActionIds).toContain(otherAction.id)
    })
  })

  describe("logActionStatusChange", () => {
    it("pushes a timeline entry to incidentLogRef with status change info", () => {
      const args = makeArgs()

      const action = createIncidentActionItem("Fix the pipeline")
      args.incidentActionsRef.current.push([serializeIncidentActionItem(action)])

      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.logActionStatusChange(action.id, "open", "in_progress", "")
      })

      const entries = args.incidentLogRef.current.toArray().map(parseIncidentLogEntry).filter(Boolean)
      expect(entries).toHaveLength(1)
      expect(entries[0]?.body).toContain("Fix the pipeline")
      expect(entries[0]?.body).toContain("Open")
      expect(entries[0]?.body).toContain("In Progress")
    })

    it("includes a comment in the log entry body when provided", () => {
      const args = makeArgs()

      const action = createIncidentActionItem("Scale up replicas")
      args.incidentActionsRef.current.push([serializeIncidentActionItem(action)])

      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.logActionStatusChange(action.id, "open", "done", "Deployed successfully")
      })

      const entries = args.incidentLogRef.current.toArray().map(parseIncidentLogEntry).filter(Boolean)
      expect(entries[0]?.body).toContain("Deployed successfully")
    })

    it("links the action id in the log entry's linkedActionIds", () => {
      const args = makeArgs()

      const action = createIncidentActionItem("Investigate alert")
      args.incidentActionsRef.current.push([serializeIncidentActionItem(action)])

      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.logActionStatusChange(action.id, "open", "blocked", "")
      })

      const entries = args.incidentLogRef.current.toArray().map(parseIncidentLogEntry).filter(Boolean)
      expect(entries[0]?.linkedActionIds).toContain(action.id)
    })

    it("is a no-op when fromStatus === toStatus", () => {
      const args = makeArgs()

      const action = createIncidentActionItem("No change action")
      args.incidentActionsRef.current.push([serializeIncidentActionItem(action)])

      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.logActionStatusChange(action.id, "open", "open", "No change here")
      })

      expect(args.incidentLogRef.current.length).toBe(0)
    })

    it("is a no-op when the action ID does not exist", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.logActionStatusChange("non-existent-id", "open", "done", "")
      })

      expect(args.incidentLogRef.current.length).toBe(0)
    })

    it("creates the log entry with type 'update'", () => {
      const args = makeArgs()

      const action = createIncidentActionItem("Verify metrics")
      args.incidentActionsRef.current.push([serializeIncidentActionItem(action)])

      const { result } = renderHook(() => useActionManager(args))

      act(() => {
        result.current.logActionStatusChange(action.id, "open", "done", "")
      })

      const entries = args.incidentLogRef.current.toArray().map(parseIncidentLogEntry).filter(Boolean)
      expect(entries[0]?.type).toBe("update")
    })
  })
})

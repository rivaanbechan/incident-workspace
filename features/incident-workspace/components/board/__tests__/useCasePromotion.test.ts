import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useCasePromotion } from "@/features/incident-workspace/components/board/useCasePromotion"
import type { BoardEntity, IncidentLogEntry } from "@/features/incident-workspace/lib/board/types"

const mockShowToast = vi.fn()
const mockCreateCaseRecordViaApi = vi.fn()

vi.mock("@/components/shell/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock("@/features/incident-workspace/lib/caseRecordPromotion", () => ({
  createCaseRecordViaApi: (...args: unknown[]) => mockCreateCaseRecordViaApi(...args),
}))

const baseArgs = {
  entities: [] as BoardEntity[],
  linkedCaseId: "case-abc",
  roomId: "room-xyz",
  selectedEntity: null as BoardEntity | null,
}

describe("useCasePromotion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateCaseRecordViaApi.mockResolvedValue({ id: "record-1" })
  })

  describe("promoteSelectedEntityToCase", () => {
    it("does nothing when selectedEntity is null", () => {
      const { result } = renderHook(() => useCasePromotion({ ...baseArgs, selectedEntity: null }))

      act(() => {
        result.current.promoteSelectedEntityToCase()
      })

      expect(mockCreateCaseRecordViaApi).not.toHaveBeenCalled()
    })

    it("promotes an incidentCard entity with kind 'finding'", async () => {
      const entity: BoardEntity = {
        body: "Degraded service on payment endpoint",
        createdAt: Date.now(),
        height: 420,
        id: "incident-1",
        severity: "high",
        status: "open",
        title: "Payment service outage",
        type: "incidentCard",
        updatedAt: Date.now(),
        width: 460,
        x: 0,
        y: 0,
        zIndex: 1,
      }

      const { result } = renderHook(() =>
        useCasePromotion({ ...baseArgs, selectedEntity: entity }),
      )

      await act(async () => {
        result.current.promoteSelectedEntityToCase()
      })

      expect(mockCreateCaseRecordViaApi).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: "case-abc",
          record: expect.objectContaining({
            kind: "finding",
            sourceType: "incident-card",
            title: "Payment service outage",
          }),
        }),
      )
    })

    it("promotes a hypothesis note with kind 'hypothesis'", async () => {
      const entity = {
        body: "The cache invalidation might be the cause",
        color: "#fef08a",
        createdAt: Date.now(),
        height: 500,
        id: "note-1",
        mapKind: "hypothesis",
        title: "Cache hypothesis",
        type: "note",
        updatedAt: Date.now(),
        width: 460,
        x: 0,
        y: 0,
        zIndex: 1,
      } as unknown as BoardEntity

      const { result } = renderHook(() =>
        useCasePromotion({ ...baseArgs, selectedEntity: entity }),
      )

      await act(async () => {
        result.current.promoteSelectedEntityToCase()
      })

      expect(mockCreateCaseRecordViaApi).toHaveBeenCalledWith(
        expect.objectContaining({
          record: expect.objectContaining({
            kind: "hypothesis",
            sourceType: "note",
          }),
        }),
      )
    })

    it("promotes an evidence note with kind 'evidence'", async () => {
      const entity = {
        body: "Log trace shows connection timeout",
        color: "#dbeafe",
        createdAt: Date.now(),
        height: 480,
        id: "note-2",
        mapKind: "evidence",
        title: "Connection timeout trace",
        type: "note",
        updatedAt: Date.now(),
        width: 460,
        x: 0,
        y: 0,
        zIndex: 1,
      } as unknown as BoardEntity

      const { result } = renderHook(() =>
        useCasePromotion({ ...baseArgs, selectedEntity: entity }),
      )

      await act(async () => {
        result.current.promoteSelectedEntityToCase()
      })

      expect(mockCreateCaseRecordViaApi).toHaveBeenCalledWith(
        expect.objectContaining({
          record: expect.objectContaining({ kind: "evidence" }),
        }),
      )
    })

    it("shows an error toast when no linkedCaseId is set", () => {
      const entity: BoardEntity = {
        body: "",
        createdAt: Date.now(),
        height: 420,
        id: "incident-1",
        severity: "high",
        status: "open",
        title: "Test incident",
        type: "incidentCard",
        updatedAt: Date.now(),
        width: 460,
        x: 0,
        y: 0,
        zIndex: 1,
      }

      const { result } = renderHook(() =>
        useCasePromotion({ ...baseArgs, linkedCaseId: null, selectedEntity: entity }),
      )

      act(() => {
        result.current.promoteSelectedEntityToCase()
      })

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: "error" }),
      )
      expect(mockCreateCaseRecordViaApi).not.toHaveBeenCalled()
    })

    it("shows an error toast when the API call fails", async () => {
      mockCreateCaseRecordViaApi.mockRejectedValue(new Error("Server error"))

      const entity: BoardEntity = {
        body: "",
        createdAt: Date.now(),
        height: 420,
        id: "incident-1",
        severity: "high",
        status: "open",
        title: "Test incident",
        type: "incidentCard",
        updatedAt: Date.now(),
        width: 460,
        x: 0,
        y: 0,
        zIndex: 1,
      }

      const { result } = renderHook(() =>
        useCasePromotion({ ...baseArgs, selectedEntity: entity }),
      )

      await act(async () => {
        result.current.promoteSelectedEntityToCase()
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: "error", message: "Server error" }),
      )
    })
  })

  describe("promoteTimelineEntryToCase", () => {
    it("promotes a decision timeline entry with kind 'decision'", async () => {
      const entry: IncidentLogEntry = {
        authorColor: "#94a3b8",
        authorId: "user-1",
        authorName: "Alice",
        body: "Decided to rollback the deployment",
        createdAt: Date.now(),
        id: "log-1",
        linkedActionIds: [],
        linkedEntityIds: [],
        type: "decision",
      }

      const { result } = renderHook(() => useCasePromotion(baseArgs))

      await act(async () => {
        result.current.promoteTimelineEntryToCase(entry)
      })

      expect(mockCreateCaseRecordViaApi).toHaveBeenCalledWith(
        expect.objectContaining({
          record: expect.objectContaining({
            kind: "decision",
            sourceType: "timeline-entry",
          }),
        }),
      )
    })

    it("promotes a non-decision timeline entry with kind 'timeline-event'", async () => {
      const entry: IncidentLogEntry = {
        authorColor: "#94a3b8",
        authorId: "user-1",
        authorName: "Alice",
        body: "Service started recovering",
        createdAt: Date.now(),
        id: "log-2",
        linkedActionIds: [],
        linkedEntityIds: [],
        type: "update",
      }

      const { result } = renderHook(() => useCasePromotion(baseArgs))

      await act(async () => {
        result.current.promoteTimelineEntryToCase(entry)
      })

      expect(mockCreateCaseRecordViaApi).toHaveBeenCalledWith(
        expect.objectContaining({
          record: expect.objectContaining({ kind: "timeline-event" }),
        }),
      )
    })
  })

  describe("promoteActionToCase", () => {
    it("promotes an action item with kind 'action' and sourceType 'action-item'", async () => {
      const action = {
        id: "action-1",
        linkedEntityIds: [],
        owner: "Bob",
        sourceLogEntryId: null,
        status: "open",
        title: "Update runbook",
      }

      const { result } = renderHook(() => useCasePromotion(baseArgs))

      await act(async () => {
        result.current.promoteActionToCase(action)
      })

      expect(mockCreateCaseRecordViaApi).toHaveBeenCalledWith(
        expect.objectContaining({
          record: expect.objectContaining({
            kind: "action",
            sourceType: "action-item",
            title: "Update runbook",
          }),
        }),
      )
    })
  })
})

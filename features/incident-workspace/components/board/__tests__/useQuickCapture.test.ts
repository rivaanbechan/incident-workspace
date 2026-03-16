import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useQuickCapture } from "@/features/incident-workspace/components/board/useQuickCapture"

const mockShowToast = vi.fn()

vi.mock("@/components/shell/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

function makeArgs() {
  return {
    addPreparedIncidentLogEntry: vi.fn(),
    createActionItem: vi.fn(),
    selectedEntityId: null as string | null,
    stageRef: { current: document.createElement("div") } as React.RefObject<HTMLElement | null>,
  }
}

describe("useQuickCapture", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("initial state", () => {
    it("starts with quick capture closed", () => {
      const { result } = renderHook(() => useQuickCapture(makeArgs()))

      expect(result.current.isQuickCaptureOpen).toBe(false)
    })

    it("starts with empty draft", () => {
      const { result } = renderHook(() => useQuickCapture(makeArgs()))

      expect(result.current.quickCaptureDraft).toBe("")
    })

    it("starts in timeline mode", () => {
      const { result } = renderHook(() => useQuickCapture(makeArgs()))

      expect(result.current.quickCaptureMode).toBe("timeline")
    })
  })

  describe("keyboard shortcut", () => {
    it("opens quick capture when 'k' key is pressed", () => {
      const { result } = renderHook(() => useQuickCapture(makeArgs()))

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "k" }))
      })

      expect(result.current.isQuickCaptureOpen).toBe(true)
    })

    it("does not open when modifier key is held with 'k'", () => {
      const { result } = renderHook(() => useQuickCapture(makeArgs()))

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))
      })

      expect(result.current.isQuickCaptureOpen).toBe(false)
    })

    it("does not open again if already open", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useQuickCapture(args))

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "k" }))
      })

      expect(result.current.isQuickCaptureOpen).toBe(true)

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "k" }))
      })

      expect(result.current.isQuickCaptureOpen).toBe(true)
    })
  })

  describe("closeQuickCapture", () => {
    it("closes the quick capture panel", () => {
      const { result } = renderHook(() => useQuickCapture(makeArgs()))

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "k" }))
      })

      act(() => {
        result.current.closeQuickCapture()
      })

      expect(result.current.isQuickCaptureOpen).toBe(false)
    })

    it("resets draft and mode on close", () => {
      const { result } = renderHook(() => useQuickCapture(makeArgs()))

      act(() => {
        result.current.setQuickCaptureDraft("some text")
        result.current.setQuickCaptureMode("action")
      })

      act(() => {
        result.current.closeQuickCapture()
      })

      expect(result.current.quickCaptureDraft).toBe("")
      expect(result.current.quickCaptureMode).toBe("timeline")
    })
  })

  describe("submitQuickCapture — timeline mode", () => {
    it("calls addPreparedIncidentLogEntry with the draft body", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useQuickCapture(args))

      act(() => {
        result.current.setQuickCaptureDraft("Deployment rolled back at 14:32")
      })

      act(() => {
        result.current.submitQuickCapture()
      })

      expect(args.addPreparedIncidentLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({ body: "Deployment rolled back at 14:32", type: "update" }),
      )
    })

    it("includes selectedEntityId in linkedEntityIds when present", () => {
      const args = { ...makeArgs(), selectedEntityId: "entity-123" }
      const { result } = renderHook(() => useQuickCapture(args))

      act(() => {
        result.current.setQuickCaptureDraft("Found root cause")
      })

      act(() => {
        result.current.submitQuickCapture()
      })

      expect(args.addPreparedIncidentLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({ linkedEntityIds: ["entity-123"] }),
      )
    })

    it("shows a success toast after submit", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useQuickCapture(args))

      act(() => {
        result.current.setQuickCaptureDraft("Mitigation applied")
      })

      act(() => {
        result.current.submitQuickCapture()
      })

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: "success" }),
      )
    })

    it("does not submit when draft is empty", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useQuickCapture(args))

      act(() => {
        result.current.submitQuickCapture()
      })

      expect(args.addPreparedIncidentLogEntry).not.toHaveBeenCalled()
    })
  })

  describe("submitQuickCapture — action mode", () => {
    it("calls createActionItem with the draft body", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useQuickCapture(args))

      act(() => {
        result.current.setQuickCaptureMode("action")
        result.current.setQuickCaptureDraft("Page the on-call engineer")
      })

      act(() => {
        result.current.submitQuickCapture()
      })

      expect(args.createActionItem).toHaveBeenCalledWith(
        "Page the on-call engineer",
        expect.anything(),
      )
    })

    it("shows a success toast after submit", () => {
      const args = makeArgs()
      const { result } = renderHook(() => useQuickCapture(args))

      act(() => {
        result.current.setQuickCaptureMode("action")
        result.current.setQuickCaptureDraft("Notify stakeholders")
      })

      act(() => {
        result.current.submitQuickCapture()
      })

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: "success" }),
      )
    })
  })
})

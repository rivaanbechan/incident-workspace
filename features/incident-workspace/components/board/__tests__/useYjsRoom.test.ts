import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import * as Y from "yjs"
import { WebsocketProvider } from "y-websocket"

vi.mock("y-websocket", () => {
  const mockAwareness = {
    getStates: vi.fn().mockReturnValue(new Map()),
    on: vi.fn(),
    off: vi.fn(),
    setLocalState: vi.fn(),
  }

  class MockWebsocketProvider {
    awareness = mockAwareness
    on = vi.fn()
    off = vi.fn()
    destroy = vi.fn()
  }

  return {
    WebsocketProvider: vi.fn().mockImplementation(function (this: MockWebsocketProvider) {
      return new MockWebsocketProvider()
    }),
  }
})

vi.mock("@/features/incident-workspace/components/board/boardCore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/incident-workspace/components/board/boardCore")>()
  return { ...actual, getCollabServerUrl: vi.fn().mockReturnValue("ws://localhost:1234") }
})

import { useYjsRoom } from "@/features/incident-workspace/components/board/useYjsRoom"
import type { PresenceUser } from "@/features/incident-workspace/lib/board/types"

const TEST_USER: PresenceUser = { id: "user-1", name: "Test User", color: "#ff0000" }

function makeArgs(overrides?: {
  onEntitiesChange?: ReturnType<typeof vi.fn>
  onConnectionsChange?: ReturnType<typeof vi.fn>
  onIncidentLogChange?: ReturnType<typeof vi.fn>
  onIncidentActionsChange?: ReturnType<typeof vi.fn>
  onMetaChange?: ReturnType<typeof vi.fn>
}) {
  const entityMapRef = { current: null as Y.Map<string> | null }
  const connectionsRef = { current: null as Y.Array<string> | null }
  const incidentActionsRef = { current: null as Y.Array<string> | null }
  const incidentLogRef = { current: null as Y.Array<string> | null }
  const metaMapRef = { current: null as Y.Map<string> | null }
  const providerRef = { current: null as InstanceType<typeof WebsocketProvider> | null }

  const callbacks = {
    onEntitiesChange: overrides?.onEntitiesChange ?? vi.fn(),
    onConnectionsChange: overrides?.onConnectionsChange ?? vi.fn(),
    onIncidentLogChange: overrides?.onIncidentLogChange ?? vi.fn(),
    onIncidentActionsChange: overrides?.onIncidentActionsChange ?? vi.fn(),
    onMetaChange: overrides?.onMetaChange ?? vi.fn(),
  }

  return {
    callbacks,
    connectionsRef,
    entityMapRef,
    incidentActionsRef,
    incidentLogRef,
    metaMapRef,
    providerRef,
    roomId: "room-abc",
    user: TEST_USER,
    // Callbacks are vi.fn() mocks — cast to satisfy UseYjsRoomArgs without exporting the internal type
  } as unknown as Parameters<typeof useYjsRoom>[0]
}

function getMockProviderInstance() {
  return vi.mocked(WebsocketProvider).mock.results[vi.mocked(WebsocketProvider).mock.results.length - 1]?.value
}

function getSyncHandler(providerInstance: ReturnType<typeof getMockProviderInstance>) {
  return providerInstance.on.mock.calls.find(([event]: [string]) => event === "sync")?.[1] as
    | ((synced: boolean) => void)
    | undefined
}

describe("useYjsRoom", () => {
  beforeEach(() => {
    vi.mocked(WebsocketProvider).mockClear()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ collabToken: "test-token" }),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("sets connectionStatus to 'disconnected' when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    )

    const args = makeArgs()
    const { result } = renderHook(() => useYjsRoom(args))

    await act(async () => {})

    expect(result.current.connectionStatus).toBe("disconnected")
  })

  it("sets connectionStatus to 'disconnected' when fetch returns non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      }),
    )

    const args = makeArgs()
    const { result } = renderHook(() => useYjsRoom(args))

    await act(async () => {})

    expect(result.current.connectionStatus).toBe("disconnected")
  })

  it("constructs WebsocketProvider with roomId when collabToken is received", async () => {
    const args = makeArgs()
    renderHook(() => useYjsRoom(args))

    await act(async () => {})

    expect(vi.mocked(WebsocketProvider)).toHaveBeenCalled()
    const callArgs = vi.mocked(WebsocketProvider).mock.calls[0]
    // Second argument should be the roomId
    expect(callArgs[1]).toBe("room-abc")
  })

  it("constructs WebsocketProvider with the collab server url", async () => {
    const args = makeArgs()
    renderHook(() => useYjsRoom(args))

    await act(async () => {})

    const callArgs = vi.mocked(WebsocketProvider).mock.calls[0]
    expect(callArgs[0]).toBe("ws://localhost:1234")
  })

  it("sets isSynced to true and connectionStatus to 'connected' when sync fires with true", async () => {
    const args = makeArgs()
    const { result } = renderHook(() => useYjsRoom(args))

    await act(async () => {})

    const providerInstance = getMockProviderInstance()
    const syncHandler = getSyncHandler(providerInstance)

    await act(async () => {
      syncHandler?.(true)
    })

    expect(result.current.isSynced).toBe(true)
    expect(result.current.connectionStatus).toBe("connected")
  })

  it("calls all 5 callbacks after setup and sync", async () => {
    const onEntitiesChange = vi.fn()
    const onConnectionsChange = vi.fn()
    const onIncidentLogChange = vi.fn()
    const onIncidentActionsChange = vi.fn()
    const onMetaChange = vi.fn()

    const args = makeArgs({
      onEntitiesChange,
      onConnectionsChange,
      onIncidentLogChange,
      onIncidentActionsChange,
      onMetaChange,
    })

    renderHook(() => useYjsRoom(args))

    await act(async () => {})

    const providerInstance = getMockProviderInstance()
    const syncHandler = getSyncHandler(providerInstance)

    await act(async () => {
      syncHandler?.(true)
    })

    // All 5 callbacks should have been called at some point during setup + sync
    expect(onEntitiesChange).toHaveBeenCalled()
    expect(onConnectionsChange).toHaveBeenCalled()
    expect(onIncidentLogChange).toHaveBeenCalled()
    expect(onIncidentActionsChange).toHaveBeenCalled()
    expect(onMetaChange).toHaveBeenCalled()
  })

  it("calls onEntitiesChange, onIncidentActionsChange, onIncidentLogChange, onMetaChange when sync fires", async () => {
    const onEntitiesChange = vi.fn()
    const onConnectionsChange = vi.fn()
    const onIncidentLogChange = vi.fn()
    const onIncidentActionsChange = vi.fn()
    const onMetaChange = vi.fn()

    const args = makeArgs({
      onEntitiesChange,
      onConnectionsChange,
      onIncidentLogChange,
      onIncidentActionsChange,
      onMetaChange,
    })

    renderHook(() => useYjsRoom(args))

    await act(async () => {})

    // Clear calls made during initial effect setup
    onEntitiesChange.mockClear()
    onConnectionsChange.mockClear()
    onIncidentLogChange.mockClear()
    onIncidentActionsChange.mockClear()
    onMetaChange.mockClear()

    const providerInstance = getMockProviderInstance()
    const syncHandler = getSyncHandler(providerInstance)

    await act(async () => {
      syncHandler?.(true)
    })

    // handleSync calls syncEntities, syncIncidentActions, syncIncidentLog, syncIncidentMeta
    expect(onEntitiesChange).toHaveBeenCalled()
    expect(onIncidentActionsChange).toHaveBeenCalled()
    expect(onIncidentLogChange).toHaveBeenCalled()
    expect(onMetaChange).toHaveBeenCalled()
  })

  it("does not set isSynced to true when sync fires with false", async () => {
    const args = makeArgs()
    const { result } = renderHook(() => useYjsRoom(args))

    await act(async () => {})

    const providerInstance = getMockProviderInstance()
    const syncHandler = getSyncHandler(providerInstance)

    await act(async () => {
      syncHandler?.(false)
    })

    expect(result.current.isSynced).toBe(false)
  })

  it("populates entityMapRef.current as a Y.Map after sync", async () => {
    const args = makeArgs()
    renderHook(() => useYjsRoom(args))

    await act(async () => {})

    const providerInstance = getMockProviderInstance()
    const syncHandler = getSyncHandler(providerInstance)

    await act(async () => {
      syncHandler?.(true)
    })

    expect(args.entityMapRef.current).not.toBeNull()
    expect(args.entityMapRef.current).toBeInstanceOf(Y.Map)
  })

  it("populates connectionsRef.current as a Y.Array after sync", async () => {
    const args = makeArgs()
    renderHook(() => useYjsRoom(args))

    await act(async () => {})

    const providerInstance = getMockProviderInstance()
    const syncHandler = getSyncHandler(providerInstance)

    await act(async () => {
      syncHandler?.(true)
    })

    expect(args.connectionsRef.current).not.toBeNull()
    expect(args.connectionsRef.current).toBeInstanceOf(Y.Array)
  })

  it("calls onEntitiesChange again when a new entity is added to entityMapRef", async () => {
    const onEntitiesChange = vi.fn()
    const args = makeArgs({ onEntitiesChange })

    renderHook(() => useYjsRoom(args))

    await act(async () => {})

    const providerInstance = getMockProviderInstance()
    const syncHandler = getSyncHandler(providerInstance)

    await act(async () => {
      syncHandler?.(true)
    })

    onEntitiesChange.mockClear()

    act(() => {
      if (args.entityMapRef.current) {
        args.entityMapRef.current.set(
          "entity-1",
          JSON.stringify({
            id: "entity-1",
            type: "note",
            x: 0,
            y: 0,
            width: 460,
            height: 420,
            zIndex: 1,
            title: "Test",
            body: "",
            color: "#fef08a",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }),
        )
      }
    })

    expect(onEntitiesChange).toHaveBeenCalled()
  })

  it("sets entityMapRef.current to null on unmount", async () => {
    const args = makeArgs()
    const { unmount } = renderHook(() => useYjsRoom(args))

    await act(async () => {})

    const providerInstance = getMockProviderInstance()
    const syncHandler = getSyncHandler(providerInstance)

    await act(async () => {
      syncHandler?.(true)
    })

    act(() => {
      unmount()
    })

    expect(args.entityMapRef.current).toBeNull()
  })

  it("calls provider.destroy() on unmount", async () => {
    const args = makeArgs()
    const { unmount } = renderHook(() => useYjsRoom(args))

    await act(async () => {})

    const providerInstance = getMockProviderInstance()

    act(() => {
      unmount()
    })

    expect(providerInstance.destroy).toHaveBeenCalled()
  })
})

import { renderHook, act, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/api/client", () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from "@/lib/api/client"
import { useRolePermissions } from "../useRolePermissions"

const mockApiRequest = vi.mocked(apiRequest)

const samplePermissions = {
  "oracle:view": { granted: true, source: "default" as const },
  "oracle:contribute": { granted: false, source: "default" as const },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApiRequest.mockResolvedValue(samplePermissions as never)
})

describe("useRolePermissions", () => {
  it("fetches permissions when roleName is provided", async () => {
    const { result } = renderHook(() => useRolePermissions("viewer"))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.permissions).toEqual(samplePermissions)
    expect(result.current.error).toBeNull()
  })

  it("does not fetch when roleName is null", async () => {
    const { result } = renderHook(() => useRolePermissions(null))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockApiRequest).not.toHaveBeenCalled()
    expect(result.current.permissions).toEqual({})
  })

  it("applies optimistic update on setPermission", async () => {
    const updated = {
      ...samplePermissions,
      "oracle:contribute": { granted: true, source: "db" as const },
    }

    mockApiRequest
      .mockResolvedValueOnce(samplePermissions as never)
      .mockResolvedValueOnce(updated as never)

    const { result } = renderHook(() => useRolePermissions("viewer"))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.setPermission("oracle:contribute", true)
    })

    expect(result.current.permissions["oracle:contribute"].granted).toBe(true)
    expect(result.current.permissions["oracle:contribute"].source).toBe("db")
  })

  it("reverts optimistic update on API error", async () => {
    mockApiRequest
      .mockResolvedValueOnce(samplePermissions as never)
      .mockRejectedValueOnce(new Error("Server error"))
      .mockResolvedValueOnce(samplePermissions as never) // refetch

    const { result } = renderHook(() => useRolePermissions("viewer"))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(
      act(async () => {
        await result.current.setPermission("oracle:contribute", true)
      }),
    ).rejects.toThrow("Server error")
  })
})

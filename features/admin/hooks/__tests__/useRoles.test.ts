import { renderHook, act, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/api/client", () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from "@/lib/api/client"
import { useRoles } from "../useRoles"

const mockApiRequest = vi.mocked(apiRequest)

const sampleRoles = [
  {
    id: "role-1",
    orgId: "org-default",
    name: "org_admin",
    label: "Administrator",
    isSystem: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockApiRequest.mockResolvedValue(sampleRoles as never)
})

describe("useRoles", () => {
  it("fetches roles on mount", async () => {
    const { result } = renderHook(() => useRoles())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.roles).toEqual(sampleRoles)
    expect(result.current.error).toBeNull()
  })

  it("sets error on fetch failure", async () => {
    mockApiRequest.mockRejectedValueOnce(new Error("Network error"))

    const { result } = renderHook(() => useRoles())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe("Network error")
    expect(result.current.roles).toEqual([])
  })

  it("adds new role to list on createRole", async () => {
    const newRole = {
      id: "role-2",
      orgId: "org-default",
      name: "analyst",
      label: "Analyst",
      isSystem: false,
      createdAt: "2024-01-01T00:00:00Z",
    }

    mockApiRequest
      .mockResolvedValueOnce(sampleRoles as never)
      .mockResolvedValueOnce(newRole as never)

    const { result } = renderHook(() => useRoles())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.createRole("analyst", "Analyst")
    })

    expect(result.current.roles).toHaveLength(2)
    expect(result.current.roles[1].name).toBe("analyst")
  })
})

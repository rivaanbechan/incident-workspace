"use client"

import { useCallback, useEffect, useState } from "react"

import { apiRequest } from "@/lib/api/client"
import type { AppRole } from "@/lib/db/roles"

type UseRolesResult = {
  roles: AppRole[]
  loading: boolean
  error: string | null
  createRole: (name: string, label: string) => Promise<AppRole>
  deleteRole: (roleId: string) => Promise<void>
  refetch: () => Promise<void>
}

export function useRoles(): UseRolesResult {
  const [roles, setRoles] = useState<AppRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await apiRequest<AppRole[]>("/api/admin/roles")
      setRoles(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roles.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  const createRole = useCallback(
    async (name: string, label: string): Promise<AppRole> => {
      const created = await apiRequest<AppRole>("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, label }),
      })

      setRoles((prev) => [...prev, created])
      return created
    },
    [],
  )

  const deleteRole = useCallback(
    async (roleId: string) => {
      await apiRequest(`/api/admin/roles/${roleId}`, { method: "DELETE" })
      setRoles((prev) => prev.filter((r) => r.id !== roleId))
    },
    [],
  )

  return {
    roles,
    loading,
    error,
    createRole,
    deleteRole,
    refetch: fetchRoles,
  }
}

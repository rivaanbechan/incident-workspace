"use client"

import { useCallback, useEffect, useState } from "react"

import { apiRequest } from "@/lib/api/client"
import type { ResolvedRolePermissions } from "@/lib/db/roles"

type UseRolePermissionsResult = {
  permissions: ResolvedRolePermissions
  loading: boolean
  error: string | null
  setPermission: (permissionId: string, granted: boolean | null) => Promise<void>
}

export function useRolePermissions(roleName: string | null): UseRolePermissionsResult {
  const [permissions, setPermissions] = useState<ResolvedRolePermissions>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPermissions = useCallback(async (name: string) => {
    setLoading(true)
    setError(null)

    try {
      const data = await apiRequest<ResolvedRolePermissions>(
        `/api/admin/roles/${name}/permissions`,
      )
      setPermissions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load permissions.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!roleName) {
      setPermissions({})
      return
    }

    fetchPermissions(roleName)
  }, [roleName, fetchPermissions])

  const setPermission = useCallback(
    async (permissionId: string, granted: boolean | null) => {
      if (!roleName) return

      // Optimistic update
      setPermissions((prev) => {
        if (granted === null) {
          return {
            ...prev,
            [permissionId]: { ...prev[permissionId], source: "default" as const },
          }
        }

        return {
          ...prev,
          [permissionId]: { granted, source: "db" as const },
        }
      })

      try {
        const updated = await apiRequest<ResolvedRolePermissions>(
          `/api/admin/roles/${roleName}/permissions`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ permissionId, granted }),
          },
        )
        setPermissions(updated)
      } catch (err) {
        // Revert on failure
        await fetchPermissions(roleName)
        throw err
      }
    },
    [roleName, fetchPermissions],
  )

  return { permissions, loading, error, setPermission }
}

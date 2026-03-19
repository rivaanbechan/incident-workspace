"use client"

import { useState } from "react"

import { EmptyState } from "@/components/shell/EmptyState"
import { Card } from "@/components/ui/card"
import type { AppRole } from "@/lib/db/roles"
import { NewRoleDialog } from "@/features/admin/components/NewRoleDialog"
import { RoleList } from "@/features/admin/components/RoleList"
import { RolePermissionMatrix } from "@/features/admin/components/RolePermissionMatrix"
import { useRoles } from "@/features/admin/hooks/useRoles"

export function RolesPage() {
  const { roles, loading, error, createRole } = useRoles()
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null)
  const [showNewRoleDialog, setShowNewRoleDialog] = useState(false)

  async function handleCreate(name: string, label: string) {
    const created = await createRole(name, label)
    setSelectedRole(created)
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr] items-start">
      <Card className="overflow-hidden" style={{ minHeight: "400px" }}>
        <RoleList
          roles={roles}
          loading={loading}
          selectedRole={selectedRole}
          onSelect={setSelectedRole}
          onNewRole={() => setShowNewRoleDialog(true)}
        />
      </Card>

      <Card className="p-5">
        {!selectedRole ? (
          <EmptyState
            heading="Select a role"
            message="Choose a role from the left panel to view and configure its permissions."
          />
        ) : (
          <div className="grid gap-4">
            <div>
              <h3 className="font-semibold text-base">{selectedRole.label}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedRole.isSystem
                  ? "System role — permissions can be configured but the role cannot be deleted."
                  : "Custom role — all permissions configurable."}
              </p>
            </div>
            <RolePermissionMatrix role={selectedRole} />
          </div>
        )}
      </Card>

      <NewRoleDialog
        open={showNewRoleDialog}
        onClose={() => setShowNewRoleDialog(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}

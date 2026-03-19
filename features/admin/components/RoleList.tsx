"use client"

import { Plus, Shield } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { AppRole } from "@/lib/db/roles"

type RoleListProps = {
  roles: AppRole[]
  loading: boolean
  selectedRole: AppRole | null
  onSelect: (role: AppRole) => void
  onNewRole: () => void
}

export function RoleList({
  roles,
  loading,
  selectedRole,
  onSelect,
  onNewRole,
}: RoleListProps) {
  if (loading) {
    return (
      <div className="grid gap-2 p-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  const orgRoles = roles.filter((r) => !r.name.startsWith("case_"))
  const caseRoles = roles.filter((r) => r.name.startsWith("case_"))
  const customRoles = roles.filter((r) => !r.isSystem)

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto p-2 grid gap-1">
        {orgRoles.length > 0 && (
          <div className="grid gap-1">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Org Roles
            </p>
            {orgRoles.map((role) => (
              <RoleItem
                key={role.id}
                role={role}
                selected={selectedRole?.id === role.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}

        {caseRoles.length > 0 && (
          <div className="grid gap-1 mt-2">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Case Roles
            </p>
            {caseRoles.map((role) => (
              <RoleItem
                key={role.id}
                role={role}
                selected={selectedRole?.id === role.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}

        {customRoles.length > 0 && (
          <div className="grid gap-1 mt-2">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Custom Roles
            </p>
            {customRoles.map((role) => (
              <RoleItem
                key={role.id}
                role={role}
                selected={selectedRole?.id === role.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={onNewRole}
        >
          <Plus className="size-4" />
          New Role
        </Button>
      </div>
    </div>
  )
}

function RoleItem({
  role,
  selected,
  onSelect,
}: {
  role: AppRole
  selected: boolean
  onSelect: (role: AppRole) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(role)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
        selected
          ? "bg-primary text-primary-foreground"
          : "hover:bg-muted/70 text-foreground",
      )}
    >
      <Shield className="size-4 shrink-0 opacity-70" />
      <span className="flex-1 text-sm font-medium truncate">{role.label}</span>
      {role.isSystem && (
        <Badge
          variant={selected ? "outline" : "secondary"}
          className="shrink-0 text-xs font-normal"
        >
          system
        </Badge>
      )}
    </button>
  )
}

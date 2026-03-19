"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { getPermissionsByDomain } from "@/lib/auth/permissionRegistry"
import type { PermissionDomain } from "@/lib/auth/permissionRegistry"
import type { AppRole } from "@/lib/db/roles"
import { PermissionDomainSection } from "@/features/admin/components/PermissionDomainSection"
import { useRolePermissions } from "@/features/admin/hooks/useRolePermissions"

const ALL_DOMAINS_BY_DOMAIN = getPermissionsByDomain()
const DOMAIN_ORDER: PermissionDomain[] = [
  "cases",
  "board",
  "agents",
  "oracle",
  "integrations",
  "investigations",
  "admin",
]

type RolePermissionMatrixProps = {
  role: AppRole
}

export function RolePermissionMatrix({ role }: RolePermissionMatrixProps) {
  const { permissions, loading, error, setPermission } = useRolePermissions(role.name)
  const isCaseRole = role.name.startsWith("case_")

  if (loading) {
    return (
      <div className="grid gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (isCaseRole) {
    const caseDomains = DOMAIN_ORDER.filter((d) => {
      const defs = ALL_DOMAINS_BY_DOMAIN[d] ?? []
      return defs.some((def) => def.axis === "case")
    })

    return (
      <div className="grid gap-3">
        {caseDomains.map((domain) => {
          const defs = (ALL_DOMAINS_BY_DOMAIN[domain] ?? []).filter((d) => d.axis === "case")
          return (
            <PermissionDomainSection
              key={domain}
              domain={domain}
              definitions={defs}
              permissions={permissions}
              onToggle={setPermission}
            />
          )
        })}
      </div>
    )
  }

  // Org role: show org-level sections first, then case-level defaults
  const orgDomains = DOMAIN_ORDER.filter((d) => {
    const defs = ALL_DOMAINS_BY_DOMAIN[d] ?? []
    return defs.some((def) => def.axis === "org")
  })

  const caseDomains = DOMAIN_ORDER.filter((d) => {
    const defs = ALL_DOMAINS_BY_DOMAIN[d] ?? []
    return defs.some((def) => def.axis === "case")
  })

  return (
    <div className="grid gap-4">
      {orgDomains.map((domain) => {
        const defs = (ALL_DOMAINS_BY_DOMAIN[domain] ?? []).filter((d) => d.axis === "org")
        return (
          <PermissionDomainSection
            key={domain}
            domain={domain}
            definitions={defs}
            permissions={permissions}
            onToggle={setPermission}
          />
        )
      })}

      <div className="flex items-center gap-2 mt-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground px-2">Case-level defaults</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <p className="text-xs text-muted-foreground">
        These are defaults for this role inside any case. Individual members can be granted higher access per case.
      </p>

      {caseDomains.map((domain) => {
        const defs = (ALL_DOMAINS_BY_DOMAIN[domain] ?? []).filter((d) => d.axis === "case")
        return (
          <PermissionDomainSection
            key={domain}
            domain={domain}
            definitions={defs}
            permissions={permissions}
            onToggle={setPermission}
          />
        )
      })}
    </div>
  )
}

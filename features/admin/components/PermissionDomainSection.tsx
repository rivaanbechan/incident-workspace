"use client"

import { ChevronDown } from "lucide-react"
import { useState } from "react"

import { cn } from "@/lib/utils"
import type { PermissionDefinition } from "@/lib/auth/permissionRegistry"
import type { ResolvedRolePermissions } from "@/lib/db/roles"
import { PermissionRow } from "@/features/admin/components/PermissionRow"

const DOMAIN_LABELS: Record<string, string> = {
  agents: "Agents",
  admin: "Administration",
  board: "Incident Board",
  cases: "Cases",
  integrations: "Integrations",
  investigations: "Investigations",
  oracle: "The Oracle",
}

type PermissionDomainSectionProps = {
  domain: string
  definitions: PermissionDefinition[]
  permissions: ResolvedRolePermissions
  onToggle: (permissionId: string, granted: boolean | null) => Promise<void>
}

export function PermissionDomainSection({
  domain,
  definitions,
  permissions,
  onToggle,
}: PermissionDomainSectionProps) {
  const [open, setOpen] = useState(true)

  if (definitions.length === 0) return null

  const label = DOMAIN_LABELS[domain] ?? domain

  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
      >
        <span className="text-sm font-semibold">{label}</span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="divide-y divide-border/50 px-1">
          {definitions.map((def) => (
            <PermissionRow
              key={def.id}
              definition={def}
              entry={permissions[def.id]}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

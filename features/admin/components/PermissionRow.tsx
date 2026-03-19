"use client"

import { Lock } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { PermissionDefinition } from "@/lib/auth/permissionRegistry"
import type { ResolvedRolePermissions } from "@/lib/db/roles"

type PermissionRowProps = {
  definition: PermissionDefinition
  entry: ResolvedRolePermissions[string] | undefined
  onToggle: (permissionId: string, granted: boolean | null) => Promise<void>
}

export function PermissionRow({ definition, entry, onToggle }: PermissionRowProps) {
  const granted = entry?.granted ?? false
  const isDefault = entry?.source === "default"
  const isSystemManaged = definition.systemManaged

  async function handleToggle(checked: boolean) {
    try {
      await onToggle(definition.id, checked)
      toast.success(
        checked
          ? `Granted: ${definition.label}`
          : `Revoked: ${definition.label}`,
      )
    } catch {
      toast.error(`Failed to update ${definition.label}.`)
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors">
      <div className="grid gap-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{definition.label}</span>
          {isDefault && !isSystemManaged && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                    default
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This is the system default for this role. Toggle to override.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {isSystemManaged && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Lock className="size-3 shrink-0 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>This permission is system-managed and cannot be configured here.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <span className="text-xs text-muted-foreground truncate">{definition.description}</span>
      </div>

      <Switch
        checked={granted}
        onCheckedChange={handleToggle}
        disabled={isSystemManaged}
        aria-label={definition.label}
      />
    </div>
  )
}

"use client"

import { Badge } from "@/components/ui/badge"
import { SelectableCard } from "@/features/integrations/components/SelectableCard"
import type { DatasourceDefinition, DatasourceInstallation } from "@/lib/datasources"

type Props = {
  definition: DatasourceDefinition
  instances: DatasourceInstallation[]
  enabledCount: number
  isSelected: boolean
  onClick: () => void
}

function VendorAvatar({ title }: { title: string }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
      {title[0]?.toUpperCase()}
    </div>
  )
}

export function IntegrationVendorCard({
  definition,
  enabledCount,
  instances,
  isSelected,
  onClick,
}: Props) {
  const configured = instances.length > 0

  return (
    <SelectableCard isSelected={isSelected} onClick={onClick} size="lg">
      <div className="flex items-start gap-3">
        <VendorAvatar title={definition.title} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-base font-semibold text-foreground">{definition.title}</span>
            {configured ? (
              <Badge variant={enabledCount > 0 ? "success" : "warning"}>
                {enabledCount}/{instances.length} active
              </Badge>
            ) : (
              <Badge variant="muted">Not configured</Badge>
            )}
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-muted-foreground">
            {definition.description}
          </p>
        </div>
      </div>

      {definition.capabilities.supportsSearch || definition.capabilities.supportsHealthcheck ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {definition.capabilities.supportsSearch && (
            <Badge variant="secondary">Search</Badge>
          )}
          {definition.capabilities.supportsHealthcheck && (
            <Badge variant="secondary">Health check</Badge>
          )}
        </div>
      ) : null}
    </SelectableCard>
  )
}

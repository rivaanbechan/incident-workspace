"use client"

import { PlusCircleIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shell/EmptyState"
import { SelectableCard } from "@/features/integrations/components/SelectableCard"
import type { DatasourceDefinition, DatasourceInstallation } from "@/lib/datasources"
import { formatTimestamp } from "@/lib/ui/formatters"

type Props = {
  instances: DatasourceInstallation[]
  selectedInstanceId: string | null
  selectedDefinition: DatasourceDefinition | null
  isLoading: boolean
  onSelectInstance: (id: string) => void
  onNewInstance: () => void
}

export function IntegrationInstanceList({
  instances,
  isLoading,
  onNewInstance,
  onSelectInstance,
  selectedDefinition,
  selectedInstanceId,
}: Props) {
  const vendorTitle = selectedDefinition?.title ?? "Datasource"

  return (
    <Card className="border-border/60 bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="text-base">{vendorTitle} instances</CardTitle>
        <Button onClick={onNewInstance} size="sm" type="button" variant="outline">
          <PlusCircleIcon className="mr-1.5 size-3.5" />
          New
        </Button>
      </CardHeader>

      <CardContent className="grid gap-2.5">
        {isLoading ? (
          <div className="grid gap-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/50" />
            ))}
          </div>
        ) : instances.length === 0 ? (
          <EmptyState
            icon={<PlusCircleIcon className="size-4 text-muted-foreground" />}
            heading="No instances yet"
            message={`Configure your first ${vendorTitle} instance below.`}
          />
        ) : null}

        {instances.map((instance) => (
          <SelectableCard
            key={instance.id}
            isSelected={selectedInstanceId === instance.id}
            onClick={() => onSelectInstance(instance.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">
                  {instance.title}
                </div>
                <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                  {instance.id}
                </div>
              </div>
              <Badge className="shrink-0" variant={instance.enabled ? "success" : "warning"}>
                {instance.enabled ? "On" : "Off"}
              </Badge>
            </div>
            <div className="mt-2 truncate text-xs text-muted-foreground">{instance.baseUrl}</div>
            <div className="mt-1 text-[11px] text-muted-foreground/70">
              Updated {formatTimestamp(instance.updatedAt)}
            </div>
          </SelectableCard>
        ))}
      </CardContent>
    </Card>
  )
}

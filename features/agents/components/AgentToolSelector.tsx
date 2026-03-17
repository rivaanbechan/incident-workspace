"use client"

import { Checkbox } from "@/components/ui/checkbox"
import type { DatasourceInstallation } from "@/lib/datasources/types"

type Props = {
  enrichmentDatasources: DatasourceInstallation[]
  onChange: (toolIds: string[]) => void
  selectedToolIds: string[]
}

export function AgentToolSelector({ enrichmentDatasources, onChange, selectedToolIds }: Props) {
  const toggle = (id: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedToolIds, id])
    } else {
      onChange(selectedToolIds.filter((t) => t !== id))
    }
  }

  if (enrichmentDatasources.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No enrichment datasources configured. Tools are optional — agents without tools will use the model directly.
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium text-foreground">Tools (enrichment datasources)</div>
      {enrichmentDatasources.map((ds) => (
        <label key={ds.id} className="flex items-center gap-3 text-sm font-medium text-foreground">
          <Checkbox
            checked={selectedToolIds.includes(ds.id)}
            onCheckedChange={(checked) => toggle(ds.id, checked === true)}
          />
          {ds.title}
          <span className="text-xs text-muted-foreground">{ds.vendor}</span>
        </label>
      ))}
    </div>
  )
}

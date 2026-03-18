"use client"

import type { HuntGraphEdge, HuntGraphFilters, HuntGraphNode } from "@/features/collab-hunt-graph/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

type HuntGraphFiltersPanelProps = {
  availableEdgeKinds: HuntGraphEdge["kind"][]
  availableNodeKinds: HuntGraphNode["kind"][]
  filters: HuntGraphFilters
  setEdgeKindEnabled: (kind: HuntGraphEdge["kind"], enabled: boolean) => void
  setNodeKindEnabled: (kind: HuntGraphNode["kind"], enabled: boolean) => void
}

export function HuntGraphFiltersPanel({
  availableEdgeKinds,
  availableNodeKinds,
  filters,
  setEdgeKindEnabled,
  setNodeKindEnabled,
}: HuntGraphFiltersPanelProps) {
  if (availableNodeKinds.length === 0 && availableEdgeKinds.length === 0) {
    return null
  }

  return (
    <Card className="border-border/60 bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Filters</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {availableNodeKinds.length > 0 && (
          <div className="grid gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Node kinds
            </div>
            {availableNodeKinds.map((kind) => {
              const enabled =
                filters.nodeKinds.length === 0 || filters.nodeKinds.includes(kind)

              return (
                <label
                  key={kind}
                  className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                >
                  <Checkbox
                    checked={enabled}
                    onCheckedChange={(checked) => setNodeKindEnabled(kind, checked === true)}
                  />
                  <span>{kind}</span>
                </label>
              )
            })}
          </div>
        )}

        {availableEdgeKinds.length > 0 && (
          <div className="grid gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Edge kinds
            </div>
            {availableEdgeKinds.map((kind) => {
              const enabled =
                filters.edgeKinds.length === 0 || filters.edgeKinds.includes(kind)

              return (
                <label
                  key={kind}
                  className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                >
                  <Checkbox
                    checked={enabled}
                    onCheckedChange={(checked) => setEdgeKindEnabled(kind, checked === true)}
                  />
                  <span>{kind}</span>
                </label>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

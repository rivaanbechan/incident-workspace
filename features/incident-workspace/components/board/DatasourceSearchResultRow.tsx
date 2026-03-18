"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DatasourceRawEventView } from "@/features/incident-workspace/components/board/DatasourceRawEventView"
import { truncateLabel } from "@/features/incident-workspace/components/board/datasourceSearchHelpers"
import type { DatasourceSearchRow } from "@/lib/datasources"

type Props = {
  row: DatasourceSearchRow
  isExpanded: boolean
  isPromoting: boolean
  onPromote: () => void
  onToggleExpand: () => void
}

export function DatasourceSearchResultRow({ row, isExpanded, isPromoting, onPromote, onToggleExpand }: Props) {
  return (
    <Card className="border-border/60 bg-card shadow-none">
      <CardContent className="grid gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="break-all text-[15px] font-semibold text-foreground">{row.title}</div>
            <div className="break-all text-[13px] leading-6 text-foreground">{row.summary}</div>
          </div>
          <Badge variant="outline">
            {row.occurredAt ? `Occurred ${row.occurredAt}` : "No timestamp"}
          </Badge>
        </div>

        {row.relatedEntities.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {row.relatedEntities.map((entity) => (
              <Badge
                key={`${row.id}-${entity.id}`}
                variant="secondary"
                title={`${entity.kind}: ${entity.label}`}
              >
                {entity.kind}: {truncateLabel(entity.label)}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {row.sourceUrl ? (
            <Button asChild size="sm" variant="secondary">
              <Link href={row.sourceUrl} target="_blank" rel="noreferrer">
                Open in Splunk
              </Link>
            </Button>
          ) : null}
          <Button onClick={onPromote} disabled={isPromoting} size="sm">
            {isPromoting ? "Promoting..." : "Promote Row"}
          </Button>
          <Button onClick={onToggleExpand} size="sm" variant="ghost">
            {isExpanded ? "Hide Raw" : "Show Raw"}
          </Button>
        </div>

        {isExpanded ? (
          <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
            <DatasourceRawEventView raw={row.raw} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

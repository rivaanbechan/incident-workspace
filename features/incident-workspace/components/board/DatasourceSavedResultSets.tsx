"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatTimestamp } from "@/lib/ui/formatters"
import type { SavedDatasourceResultSet } from "@/lib/datasources"

type Props = {
  savedResultSets: SavedDatasourceResultSet[]
  linkedCaseId?: string | null
  promotingResultSetId: string | null
  onSelectResultSet: (rs: SavedDatasourceResultSet) => void
  onPromoteToCase: (rs: SavedDatasourceResultSet) => void
}

export function DatasourceSavedResultSets({
  savedResultSets,
  linkedCaseId,
  promotingResultSetId,
  onSelectResultSet,
  onPromoteToCase,
}: Props) {
  if (savedResultSets.length === 0) return null

  return (
    <Card className="border-border/60 bg-card shadow-none">
      <CardHeader className="p-4 pb-3">
        <CardTitle className="text-sm">Saved evidence sets</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 pt-0">
        {savedResultSets.slice(0, 4).map((rs) => (
          <Card key={rs.id} className="border-border/50 bg-background/70 shadow-none">
            <CardContent className="grid gap-3 p-3">
              <button
                onClick={() => onSelectResultSet(rs)}
                className="cursor-pointer border-none bg-transparent p-0 text-left"
                type="button"
              >
                <div className="text-sm font-semibold text-foreground">{rs.title}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">{rs.summary}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span>{rs.datasourceTitle}</span>
                  <span>{rs.resultCount} results</span>
                  <span>{formatTimestamp(rs.createdAt)}</span>
                </div>
              </button>
              {linkedCaseId ? (
                <Button
                  onClick={() => onPromoteToCase(rs)}
                  disabled={promotingResultSetId === rs.id}
                  size="sm"
                  className="justify-self-start"
                >
                  {promotingResultSetId === rs.id ? "Promoting..." : "Promote To Case"}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  )
}
